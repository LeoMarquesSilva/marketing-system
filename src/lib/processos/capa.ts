import type { Confianca, SugestaoNova } from "./autos-types";
import { campoPorChave, coagirValor, estaPreenchido, formatarValor, textoDoValor, type ValorCampo, type Valores } from "./campos";

/**
 * Capa do processo completada por fontes oficiais, sempre como sugestão (decisão do Samuel, 10/11/2026):
 * - o número CNJ dá a justiça, a UF e o grau (regra, sem consulta);
 * - o DataJud (API pública do CNJ) dá o órgão julgador e o município, o ajuizamento, o sigilo, o formato
 *   e as movimentações (o último andamento).
 * Só propõe o que falta no cadastro; o último andamento também quando o DataJud tem um mais novo.
 * O vocabulário é o do VIOS, o mesmo da capa de abertura de pasta da Vistagem (src/lib/vistagem/capa-abertura.ts
 * na main): "Justiça Estadual", "PRIMEIRO GRAU", vara "12ª" e tipo "Vara Cível".
 */

/* --------------------------------------------------------------------- CNJ */

const UF_DO_TJ: Record<string, string> = {
  "01": "AC", "02": "AL", "03": "AP", "04": "AM", "05": "BA", "06": "CE", "07": "DF", "08": "ES", "09": "GO", "10": "MA",
  "11": "MT", "12": "MS", "13": "MG", "14": "PA", "15": "PB", "16": "PR", "17": "PE", "18": "PI", "19": "RJ", "20": "RN",
  "21": "RS", "22": "RO", "23": "RR", "24": "SC", "25": "SE", "26": "SP", "27": "TO",
};

const UF_DO_TRT: Record<number, string> = {
  1: "RJ", 2: "SP", 3: "MG", 4: "RS", 5: "BA", 6: "PE", 7: "CE", 8: "PA", 9: "PR", 10: "DF", 11: "AM", 12: "SC",
  13: "PB", 14: "RO", 15: "SP", 16: "MA", 17: "ES", 18: "GO", 19: "AL", 20: "SE", 21: "RN", 22: "PI", 23: "MT", 24: "MS",
};

const CAPITAL: Record<string, string> = {
  AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador", CE: "Fortaleza", DF: "Brasília", ES: "Vitória",
  GO: "Goiânia", MA: "São Luís", MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém", PB: "João Pessoa",
  PR: "Curitiba", PE: "Recife", PI: "Teresina", RJ: "Rio de Janeiro", RN: "Natal", RS: "Porto Alegre", RO: "Porto Velho",
  RR: "Boa Vista", SC: "Florianópolis", SE: "Aracaju", SP: "São Paulo", TO: "Palmas",
};

/** Opções de "Justiça" na tela do VIOS, pelo segmento J do número. */
const JUSTICA: Record<string, string> = {
  "1": "Supremo Tribunal Federal",
  "2": "Conselho Nacional de Justiça",
  "3": "Superior Tribunal de Justiça",
  "4": "Justiça Federal",
  "5": "Justiça Trabalhista",
  "6": "Justiça Eleitoral",
  "7": "Justiça Militar da União",
  "8": "Justiça Estadual",
  "9": "Justiça Militar Estadual",
};

export interface CnjDaCapa {
  digitos: string;
  justica: string | null;
  segmento: string;
  tribunal: string | null;
  uf: string | null;
  grau: "PRIMEIRO GRAU" | "SEGUNDO GRAU";
}

export function lerCnjDaCapa(numero: string | null | undefined): CnjDaCapa | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.length !== 20) return null;
  const segmento = digitos[13];
  const tr = digitos.slice(14, 16);
  const regiao = Number(tr);
  let tribunal: string | null = null;
  let uf: string | null = null;
  if (segmento === "8") {
    uf = UF_DO_TJ[tr] ?? null;
    tribunal = uf ? (uf === "DF" ? "TJDFT" : `TJ${uf}`) : null;
  } else if (segmento === "5" && regiao > 0) {
    tribunal = `TRT${regiao}`;
    uf = UF_DO_TRT[regiao] ?? null;
  } else if (segmento === "4" && regiao > 0) {
    tribunal = `TRF${regiao}`;
  }
  return { digitos, segmento, justica: JUSTICA[segmento] ?? null, tribunal, uf, grau: digitos.slice(16) === "0000" ? "SEGUNDO GRAU" : "PRIMEIRO GRAU" };
}

/** Índice do tribunal no DataJud: api_publica_tjsp, api_publica_trt2, api_publica_tjdft… */
export function indiceDoDataJud(cnj: CnjDaCapa | null): string | null {
  return cnj?.tribunal ? `api_publica_${cnj.tribunal.toLowerCase()}` : null;
}

/* ------------------------------------------------------------------- DataJud */

/** Um registro do processo no DataJud (um por grau), só os campos usados. */
export interface RegistroDataJud {
  grau?: string | null;
  dataAjuizamento?: string | null;
  nivelSigilo?: number | null;
  formato?: { nome?: string | null } | null;
  classe?: { nome?: string | null } | null;
  orgaoJulgador?: { nome?: string | null; codigoMunicipioIBGE?: number | null } | null;
  dataHoraUltimaAtualizacao?: string | null;
  movimentos?: { codigo?: number | null; nome?: string | null; dataHora?: string | null; complementosTabelados?: { nome?: string | null }[] | null }[] | null;
}

/** Um andamento para a linha do tempo do processo (proc_andamentos). */
export interface AndamentoNovo {
  quando: string;
  fonte: "datajud";
  titulo: string;
  detalhe: string | null;
  grau: string | null;
  codigo: number | null;
  chave: string;
}

/** "2025-07-14T10:20:30.000Z" ou "20250714102030" → ISO; null se não for data. */
export function dataHoraDoDataJud(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (!texto) return null;
  if (/^\d{14}$/.test(texto)) {
    const iso = `${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}T${texto.slice(8, 10)}:${texto.slice(10, 12)}:${texto.slice(12, 14)}Z`;
    return Number.isNaN(Date.parse(iso)) ? null : new Date(iso).toISOString();
  }
  const data = Date.parse(texto);
  return Number.isNaN(data) ? null : new Date(data).toISOString();
}

/**
 * Todos os movimentos do DataJud (de todas as instâncias que o tribunal enviou) como andamentos da linha do
 * tempo. A chave junta instância, código, data e nome: a mesma consulta repetida não duplica nada.
 */
export function andamentosDoDataJud(registros: RegistroDataJud[]): AndamentoNovo[] {
  const vistos = new Map<string, AndamentoNovo>();
  for (const registro of registros) {
    const grau = registro.grau?.trim() || null;
    for (const movimento of registro.movimentos ?? []) {
      const quando = dataHoraDoDataJud(movimento.dataHora);
      const titulo = movimento.nome?.trim();
      if (!quando || !titulo) continue;
      const complementos = (movimento.complementosTabelados ?? []).map((item) => item.nome?.trim()).filter((nome): nome is string => Boolean(nome));
      const codigo = typeof movimento.codigo === "number" ? movimento.codigo : null;
      const chave = ["datajud", grau ?? "", codigo ?? "", quando, titulo.toLowerCase()].join("|");
      if (!vistos.has(chave)) vistos.set(chave, { quando, fonte: "datajud", titulo, detalhe: complementos.length ? complementos.join(" · ") : null, grau, codigo, chave });
    }
  }
  return [...vistos.values()].sort((a, b) => b.quando.localeCompare(a.quando));
}

/** "20260129205622", "2026-01-29T20:56:22Z" ou "2026-01-29" → "2026-01-29". */
export function dataDoDataJud(valor: string | null | undefined): string | null {
  const d = (valor ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? null : iso;
}

/**
 * Nome do órgão no DataJud → como o VIOS escreve: tira o "Juízo Titular I - " do começo e o "da Comarca de …"
 * / "do Foro …" do fim. "Juízo Titular I - 4ª Vara Civel da Comarca de Limeira" → "4ª Vara Civel".
 */
export function orgaoSemComarca(nome: string | null | undefined): string | null {
  const texto = (nome ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^Ju[ií]zo\s+(Titular|Auxiliar|Substituto)?\s*[IVX\d]*\s*-\s*/i, "")
    .replace(/\s+(da\s+Comarca|do\s+Foro|da\s+Circunscri[cç][aã]o|do\s+Ju[ií]zo)\b.*$/i, "")
    .trim();
  return texto || null;
}

/** "12ª Vara Cível" → { vara: "12ª", tipo: "Vara Cível" }. Sem número na frente, tudo é o tipo. */
export function separarVara(orgao: string | null | undefined): { vara: string | null; tipo: string | null } {
  const texto = orgao?.trim();
  if (!texto) return { vara: null, tipo: null };
  const achado = texto.match(/^0*(\d{1,3})\s*[ªºa°]?\s+(.+)$/i);
  return achado ? { vara: `${achado[1]}ª`, tipo: achado[2].trim() } : { vara: null, tipo: texto };
}

/** Cidade pelo nome do órgão ("… da Comarca de Campinas", "Foro de Campinas", "Vara do Trabalho de Carapicuíba"). */
export function cidadeDoOrgao(orgao: string | null | undefined): string | null {
  const texto = orgao?.replace(/\s+/g, " ").trim() ?? "";
  const achado =
    texto.match(/(?:Comarca|Foro(?: Regional| Distrital)?|Vara do Trabalho|Vara Federal|Circunscri[cç][aã]o)\s+(?:de|do|da|dos|das)\s+([A-ZÀ-Ý][\p{L}' -]+?)\s*$/u) ??
    texto.match(/(?:Comarca|Foro(?: Regional| Distrital)?)\s+(?:de|do|da|dos|das)\s+([A-ZÀ-Ý][\p{L}' -]+?)(?:\s+-|\s*$)/u);
  return achado ? achado[1].trim() : null;
}

/** O registro do grau em que o processo está agora: o atualizado por último. */
export function registroAtual(registros: RegistroDataJud[]): RegistroDataJud | null {
  if (!registros.length) return null;
  const ultimoMovimento = (registro: RegistroDataJud) =>
    (registro.movimentos ?? []).reduce((maior, movimento) => (String(movimento.dataHora ?? "") > maior ? String(movimento.dataHora ?? "") : maior), "") || String(registro.dataHoraUltimaAtualizacao ?? "");
  return [...registros].sort((a, b) => ultimoMovimento(b).localeCompare(ultimoMovimento(a)))[0];
}

export function ultimoMovimento(registro: RegistroDataJud | null): { texto: string; data: string } | null {
  const movimento = [...(registro?.movimentos ?? [])]
    .filter((item) => item.nome && dataDoDataJud(item.dataHora))
    .sort((a, b) => String(b.dataHora).localeCompare(String(a.dataHora)))[0];
  if (!movimento) return null;
  const complementos = (movimento.complementosTabelados ?? []).map((item) => item.nome?.trim()).filter((nome): nome is string => Boolean(nome));
  return { texto: [movimento.nome?.trim(), ...complementos].filter(Boolean).join(" - "), data: dataDoDataJud(movimento.dataHora) as string };
}

/* ----------------------------------------------------------------- sugestões */

export interface EntradaDaCapa {
  valores: Valores;
  /** Registros do processo no DataJud (um por grau). Vazio: só as regras do número. */
  datajud: RegistroDataJud[];
  /** Nome do município do órgão julgador, pelo código do IBGE (o servidor consulta). */
  municipio?: string | null;
  /** Quando o DataJud foi consultado (AAAA-MM-DD), para o texto da sugestão. */
  consultadoEm: string;
}

const GRAU: Record<string, string> = { G1: "1º grau", G2: "2º grau", JE: "Juizado Especial", TR: "Turma Recursal" };

/**
 * Sugestões de capa para o que falta: justiça, UF e jurisdição (pelo número); cidade, órgão julgador e tipo,
 * distribuição, processo eletrônico, segredo de justiça e último andamento (pelo DataJud).
 */
export function sugestoesDaCapa(entrada: EntradaDaCapa): SugestaoNova[] {
  const { valores } = entrada;
  const cnj = lerCnjDaCapa(typeof valores.cnj === "string" ? valores.cnj : null);
  if (!cnj) return [];
  const sugestoes: SugestaoNova[] = [];
  const falta = (campo: string) => !estaPreenchido(valores[campo]);

  const propor = (fonte: "cnj" | "datajud", campo: string, bruto: ValorCampo | undefined, origem: string, confianca: Confianca, junto?: Record<string, string>) => {
    const item = campoPorChave(campo);
    if (!item || bruto === null || bruto === undefined || bruto === "") return;
    const valor = coagirValor(item, bruto);
    if (valor === undefined || valor === null || Array.isArray(valor)) return;
    sugestoes.push({
      fonte,
      tipo: "campo",
      campo,
      parteId: null,
      item: campo,
      chave: `${fonte}:${campo}:${textoDoValor(item, valor)}`,
      resumo: `${item.rotulo}: ${formatarValor(item, valor)}`,
      valor: junto ? { valor, junto } : { valor },
      pagina: null,
      trecho: origem,
      trechoConferido: true,
      confianca,
    });
  };

  // Pelo número: não depende de consulta.
  if (falta("justica")) propor("cnj", "justica", cnj.justica, `Número CNJ: segmento ${cnj.segmento} da Justiça (${cnj.justica ?? "?"}).`, "alta");
  if (falta("uf")) propor("cnj", "uf", cnj.uf, `Número CNJ: tribunal ${cnj.tribunal ?? "?"}.`, "alta");

  const atual = registroAtual(entrada.datajud);
  const segundoGrau = atual?.grau ? atual.grau === "G2" : cnj.grau === "SEGUNDO GRAU";
  if (falta("jurisdicao_atual")) {
    if (atual?.grau === "G1" || atual?.grau === "G2") {
      propor("datajud", "jurisdicao_atual", atual.grau === "G2" ? "SEGUNDO GRAU" : "PRIMEIRO GRAU", `DataJud, ${entrada.consultadoEm}: o registro mais recente do processo é do ${GRAU[atual.grau]}.`, "alta");
    } else {
      propor("cnj", "jurisdicao_atual", cnj.grau, `Número CNJ: origem ${cnj.digitos.slice(16)} (${cnj.grau === "SEGUNDO GRAU" ? "processo do próprio tribunal" : "vara de origem"}).`, "media");
    }
  }
  if (!atual) return sugestoes;

  const fonte = `DataJud (${cnj.tribunal}, ${atual.grau ? (GRAU[atual.grau] ?? atual.grau) : "grau não informado"}), ${entrada.consultadoEm}`;
  const orgaoNome = atual.orgaoJulgador?.nome?.replace(/\s+/g, " ").trim() || null;

  if (falta("cidade")) {
    const cidade = cidadeDoOrgao(orgaoNome) ?? entrada.municipio ?? (segundoGrau && cnj.uf ? CAPITAL[cnj.uf] : null);
    const deOnde = cidadeDoOrgao(orgaoNome) ? `órgão julgador "${orgaoNome}"` : entrada.municipio ? `município do órgão julgador (código IBGE ${atual.orgaoJulgador?.codigoMunicipioIBGE})` : "2º grau: a capital do estado";
    propor("datajud", "cidade", cidade, `${fonte}: ${deOnde}.`, cidadeDoOrgao(orgaoNome) || entrada.municipio ? "alta" : "media");
  }
  if (orgaoNome && !segundoGrau && (falta("orgao_julgador") || falta("tipo_orgao_julgador"))) {
    const { vara, tipo } = separarVara(orgaoSemComarca(orgaoNome));
    if (falta("orgao_julgador")) propor("datajud", "orgao_julgador", vara, `${fonte}: órgão julgador "${orgaoNome}".`, "media");
    if (falta("tipo_orgao_julgador")) propor("datajud", "tipo_orgao_julgador", tipo, `${fonte}: órgão julgador "${orgaoNome}".`, "media");
  }
  if (falta("data_distribuicao")) {
    const registroDoInicio = entrada.datajud.find((registro) => registro.grau === "G1") ?? atual;
    propor("datajud", "data_distribuicao", dataDoDataJud(registroDoInicio.dataAjuizamento), `${fonte}: data de ajuizamento.`, "alta");
  }
  if (falta("processo_eletronico") && atual.formato?.nome) {
    const eletronico = /eletr/i.test(atual.formato.nome) ? true : /f[ií]sico/i.test(atual.formato.nome) ? false : null;
    if (eletronico !== null) propor("datajud", "processo_eletronico", eletronico, `${fonte}: formato "${atual.formato.nome}".`, "alta");
  }
  if (falta("segredo_justica") && typeof atual.nivelSigilo === "number") {
    propor("datajud", "segredo_justica", atual.nivelSigilo > 0, `${fonte}: nível de sigilo ${atual.nivelSigilo}${atual.nivelSigilo > 0 ? "" : " (público)"}.`, "alta");
  }

  // Último andamento: quando falta ou quando o DataJud tem um mais novo que o do cadastro.
  const movimento = ultimoMovimento(atual);
  const dataAtual = typeof valores.ultimo_andamento_data === "string" ? valores.ultimo_andamento_data.slice(0, 10) : "";
  if (movimento && (falta("ultimo_andamento_texto") || movimento.data > dataAtual)) {
    propor("datajud", "ultimo_andamento_texto", movimento.texto, `${fonte}: movimentação de ${movimento.data.split("-").reverse().join("/")}.`, "alta", { ultimo_andamento_data: movimento.data });
  }
  return sugestoes;
}
