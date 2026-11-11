import type { Contato, Endereco } from "./types";

/**
 * Regras do cadastro de pessoas, sem banco: como comparar nomes e documentos, como ler a pessoa do
 * VIOS (tabela `pessoas` do SIOE) e como decidir, entre homônimos do VIOS, qual é a pessoa de um processo.
 */

/** Nome sem acento, caixa ou pontuação: "Loja Beta Ltda." e "LOJA BETA LTDA" dão a mesma chave. */
export function chaveNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function digitosDoDocumento(documento: string | null | undefined): string {
  return (documento ?? "").replace(/\D/g, "");
}

export type TipoPessoa = "fisica" | "juridica";

export function tipoPeloDocumento(documento: string | null | undefined): TipoPessoa | null {
  const digitos = digitosDoDocumento(documento);
  if (digitos.length === 11) return "fisica";
  if (digitos.length === 14) return "juridica";
  return null;
}

export const TIPOS_PESSOA = [
  { valor: "fisica", rotulo: "Pessoa física" },
  { valor: "juridica", rotulo: "Pessoa jurídica" },
] as const;

export const TIPOS_VINCULO = [
  { valor: "socio", rotulo: "Sócio" },
  { valor: "administrador", rotulo: "Administrador" },
  { valor: "representante", rotulo: "Representante" },
  { valor: "fiador", rotulo: "Fiador" },
  { valor: "avalista", rotulo: "Avalista" },
  { valor: "corresponsavel", rotulo: "Corresponsável" },
  { valor: "advogado", rotulo: "Advogado" },
  { valor: "outro", rotulo: "Outro vínculo" },
] as const;
export type TipoVinculo = (typeof TIPOS_VINCULO)[number]["valor"];

export function rotuloDoVinculo(tipo: string): string {
  return TIPOS_VINCULO.find((item) => item.valor === tipo)?.rotulo ?? tipo;
}

/* ---------------------------------------------------------------- VIOS */

export interface PessoaVios {
  /** Id da linha no SIOE: é por ele que processos_completo aponta a pessoa-cliente do processo. */
  sioeId: string | null;
  ci: string;
  nome: string;
  documento: string | null;
  tipo: TipoPessoa | null;
  nomeFantasia: string | null;
  categoria: string | null;
  grupoCliente: string | null;
  etiquetas: string[];
  endereco: Endereco | null;
  contatos: Contato[];
}

const texto = (valor: unknown): string | null => {
  const limpo = String(valor ?? "").trim();
  return limpo || null;
};

/** O SIOE guarda o tipo como "PESSOA FÍSICA" / "PESSOA JURÍDICA" / "OUTROS" (às vezes com o acento quebrado). */
function lerTipo(tipo: unknown, documento: string | null): TipoPessoa | null {
  const bruto = String(tipo ?? "").toUpperCase();
  if (bruto.includes("JUR")) return "juridica";
  if (bruto.includes("SICA")) return "fisica";
  return tipoPeloDocumento(documento);
}

function lerEtiquetas(valor: unknown): string[] {
  return [...new Set(String(valor ?? "").split("|").map((item) => item.trim()).filter(Boolean))];
}

/** Telefone com 10+ dígitos em que o primeiro depois do DDD é 9 é celular. */
function tipoDoTelefone(telefone: string): "celular" | "telefone" {
  const digitos = telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return digitos.length === 11 && digitos[2] === "9" ? "celular" : "telefone";
}

/** Linha da tabela `pessoas` do SIOE (espelho diário de Cadastros > Pessoas do VIOS). */
export function lerPessoaVios(linha: Record<string, unknown>): PessoaVios | null {
  const ci = String(linha.ci ?? "").replace(/\D/g, "");
  const nome = texto(linha.nome);
  if (!ci || !nome) return null;
  const documento = texto(linha.cpf_cnpj);
  const logradouro = texto(linha.logradouro);
  const rua = [logradouro, texto(linha.nro), texto(linha.complemento), texto(linha.bairro)].filter(Boolean).join(", ");
  const contatos: Contato[] = [];
  const vistos = new Set<string>();
  const incluir = (tipo: Contato["tipo"], valor: string | null) => {
    if (!valor) return;
    const chave = `${tipo === "email" || tipo === "site" ? tipo : "fone"}|${tipo === "email" || tipo === "site" ? valor.toLowerCase() : valor.replace(/\D/g, "")}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    contatos.push({ tipo, valor, whatsapp: false, observacao: null, origem: "vios" });
  };
  for (const telefone of [texto(linha.telefone), texto(linha.telefone_vios)]) if (telefone) incluir(tipoDoTelefone(telefone), telefone);
  for (const email of [texto(linha.email), texto(linha.email_vios), texto(linha.email_cobranca)]) incluir("email", email);
  incluir("site", texto(linha.site));
  return {
    sioeId: texto(linha.id),
    ci,
    nome,
    documento,
    tipo: lerTipo(linha.tipo, documento),
    nomeFantasia: texto(linha.nome_fantasia_apelido),
    categoria: texto(linha.categoria),
    grupoCliente: texto(linha.grupo_cliente),
    etiquetas: lerEtiquetas(linha.etiquetas),
    endereco: logradouro ? { endereco: rua, cidade: texto(linha.cidade), uf: texto(linha.uf)?.toUpperCase().slice(0, 2) ?? null, cep: texto(linha.cep), observacao: null, origem: "vios" } : null,
    contatos,
  };
}

export type EscolhaVios = { situacao: "achada"; pessoa: PessoaVios } | { situacao: "homonimos"; quantas: number } | { situacao: "nenhuma" };

/**
 * Qual pessoa do VIOS é a do processo, quando só temos o nome (o relatório de processos não traz o
 * documento das partes). Uma candidata: é ela. Várias: só quando todas com documento têm o mesmo e, se
 * houver alguma sem documento, o documento é um CNPJ (empresa repetida no cadastro é a mesma empresa;
 * pessoa física com o mesmo nome pode ser outra). O resto fica como homônimo, para alguém decidir.
 * Com o documento em mãos, vale o documento.
 */
export function escolherPessoaVios(candidatas: PessoaVios[], documento?: string | null): EscolhaVios {
  if (!candidatas.length) return { situacao: "nenhuma" };
  const procurado = digitosDoDocumento(documento);
  if (procurado) {
    const mesma = candidatas.find((pessoa) => digitosDoDocumento(pessoa.documento) === procurado);
    if (mesma) return { situacao: "achada", pessoa: mesma };
    // Nenhuma com este documento: só serve a candidata única que ainda não tem documento no VIOS.
    const semDocumento = candidatas.filter((pessoa) => !pessoa.documento);
    if (candidatas.length === 1 && semDocumento.length === 1) return { situacao: "achada", pessoa: semDocumento[0] };
    return semDocumento.length ? { situacao: "homonimos", quantas: candidatas.length } : { situacao: "nenhuma" };
  }
  if (candidatas.length === 1) return { situacao: "achada", pessoa: candidatas[0] };
  const documentos = new Set(candidatas.map((pessoa) => digitosDoDocumento(pessoa.documento)).filter(Boolean));
  if (documentos.size === 1) {
    const [unico] = documentos;
    const todasComDocumento = candidatas.every((pessoa) => pessoa.documento);
    if (todasComDocumento || unico.length === 14) {
      return { situacao: "achada", pessoa: candidatas.find((pessoa) => pessoa.documento) as PessoaVios };
    }
  }
  return { situacao: "homonimos", quantas: candidatas.length };
}

/** Igualdade de contato/endereço para não repetir o que a pessoa já tem. */
export function chaveDoContato(contato: Pick<Contato, "tipo" | "valor">): string {
  const telefone = contato.tipo === "celular" || contato.tipo === "telefone";
  return telefone ? `fone|${contato.valor.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}` : `${contato.tipo}|${contato.valor.trim().toLowerCase()}`;
}

export function chaveDoEndereco(endereco: Pick<Endereco, "endereco" | "cep">): string {
  return `${chaveNome(endereco.endereco)}|${(endereco.cep ?? "").replace(/\D/g, "")}`;
}

/* ---------------------------------------------------------- duplicadas */

export interface PessoaParaComparar {
  id: string;
  nomeChave: string;
  documento: string | null;
  viosCi: string | null;
}

export interface GrupoDuplicado<T extends PessoaParaComparar> {
  motivo: "documento" | "nome";
  pessoas: T[];
}

/**
 * Grupos de pessoas que parecem a mesma: mesmo CPF/CNPJ (certeza) ou mesmo nome sem documentos
 * diferentes entre si nem CIs diferentes no VIOS (suspeita, para alguém confirmar).
 */
export function agruparDuplicadas<T extends PessoaParaComparar>(pessoas: T[]): GrupoDuplicado<T>[] {
  const grupos: GrupoDuplicado<T>[] = [];
  const jaAgrupadas = new Set<string>();
  const porDocumento = new Map<string, T[]>();
  for (const pessoa of pessoas) {
    const digitos = digitosDoDocumento(pessoa.documento);
    if (digitos) porDocumento.set(digitos, [...(porDocumento.get(digitos) ?? []), pessoa]);
  }
  for (const lista of porDocumento.values()) {
    if (lista.length < 2) continue;
    grupos.push({ motivo: "documento", pessoas: lista });
    for (const pessoa of lista) jaAgrupadas.add(pessoa.id);
  }
  const porNome = new Map<string, T[]>();
  for (const pessoa of pessoas) {
    if (!pessoa.nomeChave || jaAgrupadas.has(pessoa.id)) continue;
    porNome.set(pessoa.nomeChave, [...(porNome.get(pessoa.nomeChave) ?? []), pessoa]);
  }
  for (const lista of porNome.values()) {
    if (lista.length < 2) continue;
    const documentos = new Set(lista.map((pessoa) => digitosDoDocumento(pessoa.documento)).filter(Boolean));
    const cis = new Set(lista.map((pessoa) => pessoa.viosCi).filter(Boolean));
    // Documentos ou CIs do VIOS diferentes: são homônimos de verdade, não repetição.
    if (documentos.size > 1 || cis.size > 1) continue;
    grupos.push({ motivo: "nome", pessoas: lista });
  }
  return grupos;
}
