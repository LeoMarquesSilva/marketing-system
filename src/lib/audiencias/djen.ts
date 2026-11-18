import { chaveDoLink, limparLink } from "./pje";
import type { Modalidade } from "./tipos";

/**
 * Leitura das intimações do DJEN (comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=): a intimação que
 * designa a audiência traz dia, hora, modalidade e, na audiência por vídeo, o link da sala. Serve para conferir o
 * PJe e para achar o link que o PJe não tem.
 *
 * Teste de 18/11/2026: ler só a frase da designação. Uma janela larga pegou "plataforma" e "Resolução 345"
 * numa audiência presencial e errou a modalidade.
 */

export interface ComunicacaoDjen {
  id?: number | string;
  data_disponibilizacao?: string | null;
  texto?: string | null;
  nomeOrgao?: string | null;
}

export interface AudienciaNaIntimacao {
  dataDisponibilizacao: string | null;
  /** "HH:MM" quando a intimação diz a hora. */
  hora: string | null;
  modalidade: Modalidade | null;
  link: string | null;
  trecho: string;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function textoLimpo(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/** "2026-11-19" → "19/11/2026". */
export function dataBr(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const LINK_DE_SALA = /(zoom\.us\/(j|my|w)\/|meet\.google\.com\/[a-z]|teams\.(microsoft|live)\.com\/(l\/meetup|meet)|webex\.com\/(meet|join|[a-z0-9.-]+\/j\.php)|bit\.ly\/|jitsi|whereby\.com\/)/i;
const LINK_DE_AJUDA = /(sites\.google\.com|tutorial|jte\.csjt|pautaeletronica|consulta|manual|duvidas)/i;

/** Links de sala no texto inteiro (o link costuma vir depois da frase da designação). */
export function linksDeSala(texto: string): string[] {
  const achados = texto.match(/https?:\/\/[^\s"'<>)\]]+/gi) ?? [];
  const vistos = new Set<string>();
  const links: string[] = [];
  for (const bruto of achados) {
    const url = limparLink(bruto.replace(/[.,;:]+$/, ""));
    if (!url || !LINK_DE_SALA.test(url) || LINK_DE_AJUDA.test(url)) continue;
    const chave = chaveDoLink(url) ?? url;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    links.push(url);
  }
  // Sala de verdade (zoom.us/j/...) antes de link encurtado.
  return links.sort((a, b) => Number(/bit\.ly/i.test(a)) - Number(/bit\.ly/i.test(b)));
}

/** Modalidade dita na frase: "audiência presencial", "na forma telepresencial", "modalidade híbrida". */
export function modalidadeDoTrecho(trecho: string): Modalidade | null {
  const t = semAcento(trecho).toLowerCase();
  if (/hibrid|semipresencial|semi-presencial/.test(t)) return "hibrida";
  const explicita = t.match(
    /(?:audiencia|sessao|mediacao|conciliacao)[^.]{0,60}?\b(telepresencial|presencial|virtual|por videoconferencia|videoconferencia)\b|(?:forma|modalidade|maneira)\s+(telepresencial|presencial|virtual|hibrida)|\b(presencialmente|virtualmente|telepresencialmente)\b/
  );
  const palavra = explicita?.slice(1).find(Boolean) ?? null;
  if (palavra) {
    if (/tele|virtual|video/.test(palavra)) return "video";
    if (/presencial/.test(palavra)) return "presencial";
  }
  if (/zoom|videoconferencia|telepresencial|sala virtual/.test(t)) return "video";
  return null;
}

/** A frase que contém a data e a seguinte (onde costuma estar "será realizada virtualmente..."). */
function trechoDaData(texto: string, posicao: number): string {
  const antes = texto.lastIndexOf(". ", posicao);
  const inicio = antes >= 0 && posicao - antes < 400 ? antes + 2 : Math.max(0, posicao - 300);
  let fim = posicao;
  for (let frases = 0; frases < 2; frases += 1) {
    const proximo = texto.indexOf(". ", fim + 1);
    if (proximo < 0) {
      fim = texto.length;
      break;
    }
    fim = proximo + 1;
  }
  return texto.slice(inicio, Math.min(fim, posicao + 450)).trim();
}

/**
 * Procura, da mais nova para a mais antiga, a intimação que fala da audiência do dia `diaIso`.
 * Devolve hora, modalidade e link da sala que ela traz.
 */
export function audienciaNasIntimacoes(comunicacoes: ComunicacaoDjen[], diaIso: string): AudienciaNaIntimacao | null {
  const data = dataBr(diaIso);
  const ordenadas = [...comunicacoes].sort((a, b) => (b.data_disponibilizacao ?? "").localeCompare(a.data_disponibilizacao ?? ""));
  for (const c of ordenadas) {
    const texto = textoLimpo(c.texto);
    let posicao = texto.indexOf(data);
    while (posicao >= 0) {
      const trecho = trechoDaData(texto, posicao);
      const t = semAcento(trecho).toLowerCase();
      // Só a frase que marca a audiência: "designo", "designa-se", "redesigno", "agendar", "incluído em pauta".
      if (/(design|agend|pauta|realizad[ao] (no|em) dia|para o dia)/.test(t) && /(audiencia|sessao|mediacao|conciliacao)/.test(t) && !/realizada em \d{2}\/\d{2}/.test(t)) {
        const depois = texto.slice(posicao + data.length, posicao + data.length + 25);
        const hora = depois.match(/^\D{0,15}?(\d{1,2})\s*[:h]\s*(\d{2})/);
        return {
          dataDisponibilizacao: c.data_disponibilizacao ?? null,
          hora: hora ? `${hora[1]!.padStart(2, "0")}:${hora[2]}` : null,
          modalidade: modalidadeDoTrecho(trecho),
          link: linksDeSala(texto)[0] ?? null,
          trecho,
        };
      }
      posicao = texto.indexOf(data, posicao + data.length);
    }
  }
  return null;
}
