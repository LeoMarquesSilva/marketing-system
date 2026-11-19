import type { PessoaPauta } from "./tipos";

/**
 * Titular e backup vêm da pasta no VIOS: o titular é o advogado responsável (nome completo, como o SIOE guarda em
 * processos_completo.advogado_responsavel) e o backup é o auxiliar da dupla (sigla, como o "Processos Lista" traz:
 * "HPC", "BTAR").
 */

export function chaveNomePessoa(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Helena Prado Costa" → "HPC"; "Diana de Souza Lima" → "DSL" (sem preposições). */
export function siglaDoNome(nome: string | null | undefined): string {
  return chaveNomePessoa(nome)
    .split(" ")
    .filter((p) => p && !["de", "da", "do", "dos", "das", "e"].includes(p))
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "Bruna Teixeira Alves Rocha" → "Bruna Teixeira" (primeiro e segundo nomes, como a equipe se chama). */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const uteis = partes.filter((p, i) => i === 0 || !/^(d[aeo]s?|e)$/i.test(p));
  return uteis.slice(0, 2).join(" ");
}

export function pessoaPorNome(pessoas: Iterable<PessoaPauta>, nome: string | null | undefined): PessoaPauta | null {
  const chave = chaveNomePessoa(nome);
  if (!chave) return null;
  let parcial: PessoaPauta | null = null;
  for (const p of pessoas) {
    const dela = chaveNomePessoa(p.nomeVios);
    if (dela === chave) return p;
    if (!parcial && (dela.startsWith(chave) || chave.startsWith(dela))) parcial = p;
  }
  return parcial;
}

/** A sigla do auxiliar só vale se apontar para uma pessoa só. */
export function pessoaPorSigla(pessoas: Iterable<PessoaPauta>, sigla: string | null | undefined): PessoaPauta | null {
  const alvo = (sigla ?? "").trim().toUpperCase();
  if (!alvo) return null;
  const achadas = [...pessoas].filter((p) => (p.sigla ?? siglaDoNome(p.nomeVios)).toUpperCase() === alvo);
  return achadas.length === 1 ? achadas[0]! : null;
}

export interface DuplaDaPasta {
  titularId: string | null;
  backupId: string | null;
}

export function duplaDaPasta(
  pessoas: PessoaPauta[],
  pasta: { advogadoResponsavel?: string | null; auxiliarSigla?: string | null; auxiliarNome?: string | null }
): DuplaDaPasta {
  const titular = pessoaPorNome(pessoas, pasta.advogadoResponsavel);
  const backup = pessoaPorNome(pessoas, pasta.auxiliarNome) ?? pessoaPorSigla(pessoas, pasta.auxiliarSigla);
  return { titularId: titular?.id ?? null, backupId: backup && backup.id !== titular?.id ? backup.id : null };
}
