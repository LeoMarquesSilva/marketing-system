import "server-only";

import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";
import { ORG_DIVISIONS } from "@/lib/rh/org-chart";
import { areasDaPessoa, chaveNome, departamentoNaVistagem, escritorioDaArea } from "./agendamento";
import { admin } from "./server";

/** Nome de cada time do organograma pela chave ("financeiro" → "Financeiro"). */
const ROTULO_DO_TIME = new Map(ORG_DIVISIONS.flatMap((divisao) => divisao.teams.map((time) => [time.key, time.label] as const)));

export interface PessoasPorNome {
  /** Foto pela chave do nome (chaveNome); só quem tem foto. */
  fotos: Record<string, string>;
  /** Áreas (escritórios) de cada pessoa achada: departamento no RH e liderança em Usuários; "*" = todas. */
  areas: Record<string, string[]>;
  /** Área para mostrar ao lado do nome: o departamento (ex.: "Trabalhista", "Sócio"). */
  rotulos: Record<string, string>;
}

type Empregado = { id: string; full_name: string | null; department: string | null; user_id: string | null; is_active: boolean | null };
type Usuario = {
  id: string;
  name: string | null;
  department: string | null;
  avatar_url: string | null;
  photo_onedrive_url: string | null;
  ferias_access_mode: string | null;
  ferias_area_scope: string[] | null;
  is_active: boolean | null;
};

/** Mesmo nome repetido (ex.: cadastro antigo desligado): fica o ativo. */
function porNome<T extends { is_active: boolean | null }>(linhas: T[], nome: (linha: T) => string | null, procurados: Set<string>): Map<string, T> {
  const mapa = new Map<string, T>();
  for (const linha of linhas) {
    const chave = chaveNome(nome(linha));
    if (!procurados.has(chave)) continue;
    const atual = mapa.get(chave);
    if (!atual || (!atual.is_active && linha.is_active)) mapa.set(chave, linha);
  }
  return mapa;
}

/**
 * Foto e área das pessoas citadas na vistagem (usuários do VIOS e advogado da pasta), pelo nome que vem do VIOS.
 * O nome bate com o do RH: a foto é a do usuário ou, sem ela, a do organograma; a área é o departamento no RH
 * mais o escopo de liderança em Usuários (Férias personalizado). Quem não está no RH é procurado no cadastro de
 * usuários, com o departamento de lá. As tabelas são pequenas: lê tudo e compara pela chave do nome (sem acento).
 */
export async function pessoasPorNome(nomes: (string | null | undefined)[]): Promise<PessoasPorNome> {
  const procurados = new Set(nomes.map(chaveNome).filter(Boolean));
  const resultado: PessoasPorNome = { fotos: {}, areas: {}, rotulos: {} };
  if (!procurados.size) return resultado;
  const db = admin();
  const [rh, usuarios, organograma] = await Promise.all([
    db.from("hr_employees").select("id, full_name, department, user_id, is_active").limit(5000),
    db
      .from("users")
      .select("id, name, department, avatar_url, photo_onedrive_url, ferias_access_mode, ferias_area_scope, is_active")
      .limit(5000),
    db.from("org_chart_members").select("employee_id, photo_url, placement, team_key").not("employee_id", "is", null).limit(5000),
  ]);
  if (rh.error) throw new Error(rh.error.message);
  if (usuarios.error) throw new Error(usuarios.error.message);
  if (organograma.error) throw new Error(organograma.error.message);

  const todosUsuarios = (usuarios.data ?? []) as Usuario[];
  const usuarioPorId = new Map(todosUsuarios.map((usuario) => [usuario.id, usuario]));
  const fotoDoOrganograma = new Map<string, string>();
  // Times de cada pessoa no organograma (Controladoria, Financeiro…), para separar quem vista em Operações Legais.
  const timesDaPessoa = new Map<string, { chave: string; rotulo: string }[]>();
  type Membro = { employee_id: string; photo_url: string | null; placement: string | null; team_key: string | null };
  for (const membro of (organograma.data ?? []) as Membro[]) {
    if (membro.placement === "hidden") continue;
    if (membro.photo_url && !fotoDoOrganograma.has(membro.employee_id)) fotoDoOrganograma.set(membro.employee_id, membro.photo_url);
    const time = membro.team_key ? ROTULO_DO_TIME.get(membro.team_key) : undefined;
    if (membro.team_key && time) timesDaPessoa.set(membro.employee_id, [...(timesDaPessoa.get(membro.employee_id) ?? []), { chave: membro.team_key, rotulo: time }]);
  }
  // O escopo de liderança só vale no modo personalizado (no automático, a área é a do RH).
  const escopo = (usuario: Usuario | undefined) => (usuario?.ferias_access_mode === "custom" ? usuario.ferias_area_scope : null);
  const guardar = (chave: string, foto: string | null, departamento: string | null, usuario: Usuario | undefined) => {
    if (foto) resultado.fotos[chave] = foto;
    const areas = areasDaPessoa(departamento, escopo(usuario));
    if (areas.length) resultado.areas[chave] = areas;
    const rotulo = escritorioDaArea(departamento);
    if (rotulo) resultado.rotulos[chave] = rotulo;
  };

  const fotoDoUsuario = (usuario: Usuario | undefined) => (usuario ? resolveEmployeeAvatarUrl(usuario.avatar_url, usuario.photo_onedrive_url) : null);
  const empregados = porNome((rh.data ?? []) as Empregado[], (pessoa) => pessoa.full_name, procurados);
  const usuariosPorNome = porNome(todosUsuarios, (linha) => linha.name, procurados);
  for (const [chave, pessoa] of empregados) {
    const usuario = pessoa.user_id ? usuarioPorId.get(pessoa.user_id) : undefined;
    const foto = fotoDoUsuario(usuario) ?? fotoDoOrganograma.get(pessoa.id) ?? fotoDoUsuario(usuariosPorNome.get(chave));
    guardar(chave, foto, departamentoNaVistagem(pessoa.department ?? usuario?.department ?? null, timesDaPessoa.get(pessoa.id) ?? []), usuario);
  }
  for (const [chave, usuario] of usuariosPorNome) {
    if (!empregados.has(chave)) guardar(chave, fotoDoUsuario(usuario), usuario.department, usuario);
  }
  return resultado;
}
