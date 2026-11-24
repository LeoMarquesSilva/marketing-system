/**
 * Resumo da fila do robô de autos para o painel de robôs (Easypanel): o que está na fila agora, o que terminou hoje
 * e os últimos erros. Só números, sistema, tribunal, número do processo e a mensagem de erro: nada de partes,
 * cliente ou quem pediu. Funções puras, sem banco, para dar para testar.
 */

export interface LinhaDaFila {
  status: string;
  motivo_espera: string | null;
  sistema: string;
  tribunal: string;
  cnj: string;
  robo: string | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
}

export interface ResumoDaFila {
  agora: { naFila: number; baixando: number; aguardandoPessoa: number; motivos: Record<string, number>; maisAntigoNaFilaEm: string | null };
  hoje: { concluidos: number; erros: number };
  porSistema: Record<string, number>;
  robos: { nome: string; ultimoEm: string; baixando: number }[];
  erros: { cnj: string; sistema: string; tribunal: string; erro: string; em: string }[];
}

/** 0h de hoje em Brasília (UTC-3, sem horário de verão), em milissegundos. */
export function inicioDoDiaBr(agoraMs: number): number {
  const deslocamento = 3 * 3600_000;
  const local = agoraMs - deslocamento;
  return local - (local % 86_400_000) + deslocamento;
}

const LIMITE_ERRO = 240;

export function resumirFila(abertos: LinhaDaFila[], finais: LinhaDaFila[], agoraMs: number): ResumoDaFila {
  const inicioHoje = inicioDoDiaBr(agoraMs);
  const deHoje = (linha: LinhaDaFila) => Date.parse(linha.concluido_em ?? linha.atualizado_em) >= inicioHoje;
  const motivos: Record<string, number> = {};
  const porSistema: Record<string, number> = {};
  for (const linha of abertos) {
    porSistema[linha.sistema] = (porSistema[linha.sistema] ?? 0) + 1;
    if (linha.status === "aguardando_pessoa" && linha.motivo_espera) motivos[linha.motivo_espera] = (motivos[linha.motivo_espera] ?? 0) + 1;
  }
  const naFila = abertos.filter((linha) => linha.status === "pendente");

  // Robôs vistos nas últimas 24 h (pelo pedido mais recente de cada um).
  const robos = new Map<string, { nome: string; ultimoEm: string; baixando: number }>();
  for (const linha of [...abertos, ...finais]) {
    if (!linha.robo) continue;
    const atual = robos.get(linha.robo) ?? { nome: linha.robo, ultimoEm: linha.atualizado_em, baixando: 0 };
    if (linha.atualizado_em > atual.ultimoEm) atual.ultimoEm = linha.atualizado_em;
    if (linha.status === "em_andamento") atual.baixando += 1;
    robos.set(linha.robo, atual);
  }

  const erros = finais
    .filter((linha) => linha.status === "erro")
    .sort((a, b) => (b.concluido_em ?? b.atualizado_em).localeCompare(a.concluido_em ?? a.atualizado_em))
    .slice(0, 20)
    .map((linha) => ({
      cnj: linha.cnj,
      sistema: linha.sistema,
      tribunal: linha.tribunal,
      // Sem o "Call log" do Playwright e sem o diagnóstico (caminho de arquivo do servidor).
      erro: (linha.erro ?? "").split("\n")[0].replace(/\s*Diagnóstico guardado em \S+/i, "").slice(0, LIMITE_ERRO),
      em: linha.concluido_em ?? linha.atualizado_em,
    }));

  return {
    agora: {
      naFila: naFila.length,
      baixando: abertos.filter((linha) => linha.status === "em_andamento").length,
      aguardandoPessoa: abertos.filter((linha) => linha.status === "aguardando_pessoa").length,
      motivos,
      maisAntigoNaFilaEm: naFila.map((linha) => linha.criado_em).sort()[0] ?? null,
    },
    hoje: {
      concluidos: finais.filter((linha) => linha.status === "concluido" && deHoje(linha)).length,
      erros: finais.filter((linha) => linha.status === "erro" && deHoje(linha)).length,
    },
    porSistema,
    robos: [...robos.values()].sort((a, b) => b.ultimoEm.localeCompare(a.ultimoEm)),
    erros,
  };
}
