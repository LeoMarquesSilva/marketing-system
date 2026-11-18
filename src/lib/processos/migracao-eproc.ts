import { mascararCnj } from "./tribunais";

/**
 * Processos do TJSP que saíram do e-SAJ para o eproc: os autos do e-SAJ terminam com a certidão "o presente
 * processo passará a tramitar eletronicamente no Sistema Eproc do Tribunal de Justiça do Estado de São Paulo,
 * sob o número …". Daí em diante o processo continua no eproc, e os autos de lá completam os do e-SAJ.
 *
 * O texto extraído do PDF parte palavras no meio ("p rocesso", "núm ero"): a busca é no texto só com letras e
 * números. As menções genéricas ao eproc (rodapé das guias de custas, cronograma de implantação) não contam.
 */

export interface MigracaoParaEproc {
  /** Página dos autos com a certidão. */
  pagina: number;
  /** Número do processo no eproc, com máscara, quando a certidão traz. */
  numero: string | null;
  /** Trecho da página, como está no PDF, para mostrar de onde saiu. */
  trecho: string;
}

function compactar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const MARCAS = ["tramitareletronicamentenosistemaeproc", "passaraatramitarnosistemaeproc", "migradoparaosistemaeproc", "migradoparaoeproc"];

/** Procura a certidão de migração nos autos, da última página para a primeira. */
export function migracaoParaEproc(paginas: string[]): MigracaoParaEproc | null {
  for (let indice = paginas.length - 1; indice >= 0; indice -= 1) {
    const compacta = compactar(paginas[indice]);
    const marca = MARCAS.find((item) => compacta.includes(item));
    if (!marca) continue;
    const depois = compacta.slice(compacta.indexOf(marca) + marca.length, compacta.indexOf(marca) + marca.length + 200);
    const digitos = /sobonumero(\d{20})/.exec(depois)?.[1] ?? null;
    const original = paginas[indice].replace(/\s+/g, " ");
    const inicio = original.search(/tramitar|migrad/i);
    const trecho = (inicio >= 0 ? original.slice(Math.max(0, inicio - 60), inicio + 220) : original.slice(0, 280)).trim();
    return { pagina: indice + 1, numero: digitos ? mascararCnj(digitos) : null, trecho };
  }
  return null;
}
