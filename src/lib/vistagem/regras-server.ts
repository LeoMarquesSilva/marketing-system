import "server-only";

import { OPENAI_DEFAULT_MODEL } from "@/lib/openai-models";
import { openAIKey } from "@/lib/openai-keys";
import { MOTIVO_INDICE } from "./captura";
import { CONFIGURACOES_PADRAO, type ConfiguracoesVistagem } from "./configuracoes";
import { historicoDeConfiguracoes, lerConfiguracoes, type AlteracaoDeConfiguracao } from "./configuracoes-server";
import { pessoasPorNome } from "./pessoas-server";
import { IAS_DA_VISTAGEM, ORIGEM_DA_REGRA, REGRAS_DA_ESTEIRA, type EtapaDocumentada, type IaDocumentada, type MetricaDaRegra, type OrigemDaRegra } from "./regras-documentacao";
import { envioSimulado, modoAgendamento, sinteseSimulada } from "./sama";
import { admin, falhou, hojeEmSaoPaulo } from "./server";
import { MOTIVO_EX_CLIENTE_SEM_ESCRITORIO, PREFIXO_DESCARTE_CONTROLADORIA } from "./triagem";
import { nomeNoRh, nomesDosVistadores, type MapaDeVistadores } from "./vistadores";
import { chaveNome } from "./agendamento";

/** Janela dos números da tela de configurações. */
const DIAS_DAS_METRICAS = 30;
const PAGINA = 1000;
const MAXIMO = 20000;

export interface UsoDaIa {
  /** Sugestões de tarefa geradas no período. */
  geradas: number;
  usada: number;
  usadaComAlteracao: number;
  naoUsada: number;
  /** Ainda sem vistagem (sem resultado). */
  semResultado: number;
  custoUS: number;
}

export interface UsoDaTriagemIa {
  geradas: number;
  porNumero: number;
  porParte: number;
  porIa: number;
  custoUS: number;
}

export interface PessoaParaVistador {
  nome: string;
  area: string | null;
  foto: string | null;
}

export interface PainelDeRegras {
  configuracoes: ConfiguracoesVistagem;
  padroes: ConfiguracoesVistagem;
  etapas: EtapaDocumentada[];
  ias: IaDocumentada[];
  origens: Record<OrigemDaRegra, { rotulo: string; dica: string }>;
  metricas: Record<MetricaDaRegra, number>;
  diasDasMetricas: number;
  usoDaIa: UsoDaIa;
  usoDaTriagemIa: UsoDaTriagemIa;
  ambiente: {
    envioReal: boolean;
    sinteseReal: boolean;
    modoAgendamento: "intimacao" | "pasta";
    iaComChave: boolean;
    modeloIa: string;
  };
  historico: AlteracaoDeConfiguracao[];
  /** Pessoas ativas do RH, para escolher o vistador (com foto). */
  pessoas: PessoaParaVistador[];
  /** Foto de cada vistador cadastrado, pelo nome usado na configuração. */
  fotosDosVistadores: Record<string, string>;
  /** Foto de quem aparece no histórico (quem alterou e quem entrou ou saiu), pelo nome como está lá. */
  fotosDoHistorico: Record<string, string>;
}

async function todasAsPaginas<T>(
  contexto: string,
  pagina: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; de < MAXIMO; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    if (error) falhou(contexto, error);
    linhas.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGINA) break;
  }
  return linhas;
}

function inicioDaJanela(): { data: string; instante: string } {
  const [ano, mes, dia] = hojeEmSaoPaulo().split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia - (DIAS_DAS_METRICAS - 1))).toISOString().slice(0, 10);
  // Meia-noite em São Paulo (UTC−3).
  return { data, instante: `${data}T03:00:00.000Z` };
}

type LinhaDaMetrica = {
  status: string;
  duplicidade_criterio: string | null;
  motivo_descarte: string | null;
  triada_em: string | null;
  triagem_resolvida_por: string | null;
  demanda_risco: boolean | null;
  devolucoes: number | null;
  sugestao_ia_resultado: string | null;
  custo_ia: string | null;
  origem_triagem: string | null;
  custo_triagem: string | null;
  tem_sugestao_ia: string | null;
};

/** Números de cada regra nos últimos 30 dias (pelo dia em que a publicação entrou). */
async function calcularMetricas(): Promise<{ metricas: Record<MetricaDaRegra, number>; usoDaIa: UsoDaIa; usoDaTriagemIa: UsoDaTriagemIa }> {
  const db = admin();
  const janela = inicioDaJanela();
  const [linhas, arquivos, checadas] = await Promise.all([
    todasAsPaginas<LinhaDaMetrica>("calcular os números das regras", (de, ate) =>
      db
        .from("vistagem_publicacoes")
        .select(
          "status, duplicidade_criterio, motivo_descarte, triada_em, triagem_resolvida_por, demanda_risco, devolucoes, sugestao_ia_resultado, custo_ia:sugestao_ia->>custoUS, tem_sugestao_ia:sugestao_ia->>geradaEm, origem_triagem:sugestao_triagem->>origem, custo_triagem:sugestao_triagem->>custoUS"
        )
        .gte("created_at", janela.instante)
        .order("id")
        .range(de, ate)
    ),
    db.from("vistagem_kurier_arquivos").select("id", { count: "exact", head: true }).gte("data_arquivo", janela.data).neq("status", "erro").neq("origem", "colado"),
    db.from("vistagem_publicacoes").select("id", { count: "exact", head: true }).eq("status", "checado").gte("checado_em", janela.instante),
  ]);
  if (arquivos.error) falhou("contar os arquivos", arquivos.error);
  if (checadas.error) falhou("contar as checadas", checadas.error);

  const metricas: Record<MetricaDaRegra, number> = {
    arquivos: arquivos.count ?? 0,
    duplicidadesTexto: 0,
    duplicidadesDocumento: 0,
    descartesIndice: 0,
    descartesExCliente: 0,
    descartesManuais: 0,
    triadasAutomaticas: 0,
    resolvidasNaTriagem: 0,
    demandasDeRisco: 0,
    devolucoes: 0,
    checadas: checadas.count ?? 0,
  };
  const usoDaIa: UsoDaIa = { geradas: 0, usada: 0, usadaComAlteracao: 0, naoUsada: 0, semResultado: 0, custoUS: 0 };
  const usoDaTriagemIa: UsoDaTriagemIa = { geradas: 0, porNumero: 0, porParte: 0, porIa: 0, custoUS: 0 };

  for (const linha of linhas) {
    if (linha.status === "duplicidade") {
      if (linha.duplicidade_criterio === "id_documento") metricas.duplicidadesDocumento += 1;
      else metricas.duplicidadesTexto += 1;
    }
    if (linha.status === "descartada") {
      if (linha.motivo_descarte === MOTIVO_INDICE) metricas.descartesIndice += 1;
      else if (linha.motivo_descarte === MOTIVO_EX_CLIENTE_SEM_ESCRITORIO) metricas.descartesExCliente += 1;
      else if (linha.motivo_descarte?.startsWith(PREFIXO_DESCARTE_CONTROLADORIA)) metricas.descartesManuais += 1;
    }
    if (linha.triagem_resolvida_por) metricas.resolvidasNaTriagem += 1;
    else if (linha.triada_em && linha.status !== "triagem_pendente" && linha.status !== "descartada") metricas.triadasAutomaticas += 1;
    if (linha.demanda_risco) metricas.demandasDeRisco += 1;
    if (linha.devolucoes) metricas.devolucoes += linha.devolucoes;

    if (linha.tem_sugestao_ia) {
      usoDaIa.geradas += 1;
      usoDaIa.custoUS += Number(linha.custo_ia) || 0;
      if (linha.sugestao_ia_resultado === "usada") usoDaIa.usada += 1;
      else if (linha.sugestao_ia_resultado === "usada_com_alteracao") usoDaIa.usadaComAlteracao += 1;
      else if (linha.sugestao_ia_resultado === "nao_usada") usoDaIa.naoUsada += 1;
      else usoDaIa.semResultado += 1;
    }
    if (linha.origem_triagem) {
      usoDaTriagemIa.geradas += 1;
      usoDaTriagemIa.custoUS += Number(linha.custo_triagem) || 0;
      if (linha.origem_triagem === "numero") usoDaTriagemIa.porNumero += 1;
      else if (linha.origem_triagem === "parte") usoDaTriagemIa.porParte += 1;
      else usoDaTriagemIa.porIa += 1;
    }
  }
  return { metricas, usoDaIa, usoDaTriagemIa };
}

/** Pessoas ativas do RH (nome e área), para escolher os vistadores. */
async function pessoasDoRh(): Promise<{ nome: string; area: string | null }[]> {
  const { data, error } = await admin().from("hr_employees").select("full_name, department").eq("is_active", true).order("full_name").limit(2000);
  if (error) falhou("carregar as pessoas do RH", error);
  return ((data ?? []) as { full_name: string | null; department: string | null }[])
    .filter((pessoa) => pessoa.full_name?.trim())
    .map((pessoa) => ({ nome: (pessoa.full_name as string).trim(), area: pessoa.department }));
}

/** Tudo o que a tela de configurações mostra. */
export async function painelDeRegras(): Promise<PainelDeRegras> {
  const [configuracoes, { metricas, usoDaIa, usoDaTriagemIa }, historico, pessoas] = await Promise.all([
    lerConfiguracoes(),
    calcularMetricas(),
    historicoDeConfiguracoes(),
    pessoasDoRh(),
  ]);
  const vistadores = nomesDosVistadores(configuracoes.vistadores);
  // Nomes do histórico: quem alterou e quem entrou ou saiu dos vistadores (pode não estar mais no mapa).
  const nomesDoHistorico = [
    ...new Set(
      historico.flatMap((item) => [
        ...(item.alteradoPor ? [item.alteradoPor] : []),
        ...(item.chave === "vistadores"
          ? [...nomesDosVistadores((item.valorAnterior ?? {}) as MapaDeVistadores), ...nomesDosVistadores((item.valorNovo ?? {}) as MapaDeVistadores)]
          : []),
      ])
    ),
  ];
  const fotos = await pessoasPorNome([...pessoas.map((pessoa) => pessoa.nome), ...vistadores.map(nomeNoRh), ...nomesDoHistorico.map(nomeNoRh)])
    .then((resultado) => resultado.fotos)
    .catch(() => ({}) as Record<string, string>);
  const fotosDosVistadores: Record<string, string> = {};
  for (const nome of vistadores) {
    const foto = fotos[chaveNome(nomeNoRh(nome))];
    if (foto) fotosDosVistadores[nome] = foto;
  }
  const fotosDoHistorico: Record<string, string> = {};
  for (const nome of nomesDoHistorico) {
    const foto = fotos[chaveNome(nomeNoRh(nome))];
    if (foto) fotosDoHistorico[nome] = foto;
  }
  return {
    configuracoes,
    padroes: CONFIGURACOES_PADRAO,
    etapas: REGRAS_DA_ESTEIRA,
    ias: IAS_DA_VISTAGEM,
    origens: ORIGEM_DA_REGRA,
    metricas,
    diasDasMetricas: DIAS_DAS_METRICAS,
    usoDaIa,
    usoDaTriagemIa,
    ambiente: {
      envioReal: !envioSimulado(),
      sinteseReal: !sinteseSimulada(),
      modoAgendamento: modoAgendamento(),
      iaComChave: Boolean(openAIKey("analisePublicacao")),
      modeloIa: OPENAI_DEFAULT_MODEL,
    },
    historico,
    pessoas: pessoas.map((pessoa) => ({ ...pessoa, foto: fotos[chaveNome(pessoa.nome)] ?? null })),
    fotosDosVistadores,
    fotosDoHistorico,
  };
}
