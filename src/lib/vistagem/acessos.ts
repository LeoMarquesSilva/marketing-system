import type { PapelVistagem } from "@/lib/access-control";
import { chaveNome } from "./agendamento";
import { VistagemError } from "./errors";
import { ESCRITORIOS } from "./triagem";
import { TIPOS_DE_DEMANDA, TODAS_AS_AREAS_VISTAGEM, nomeNoRh, vistadoresDa, type MapaDeVistadores, type TipoDeDemanda } from "./vistadores";

/**
 * Quem acessa a Vistagem e o que cada um enxerga, editado em Vistagem › Configurações (antes ficava em Usuários).
 * A controladoria vê todas as abas e áreas; o jurídico vê a Visão geral e a aba Vistagem, só das áreas marcadas. Quem
 * não vista risco não recebe as demandas de risco na fila A vistar, mas vê tudo o que é da área (Vistado, Visão geral,
 * Histórico). Liberar o módulo para alguém continua em Usuários (lista de módulos
 * de cada pessoa). Quem grava é `acessos-server.ts`; aqui ficam a validação e as contas, para a tela e o servidor.
 */

/** Onde a pessoa está na lista de vistadores (Configurações › Vistadores por área). */
export interface VistadorEm {
  area: string;
  tipos: TipoDeDemanda[];
}

export interface AcessoVistagem {
  /** id em users. */
  id: string;
  nome: string;
  email: string | null;
  foto: string | null;
  /** Admin é sempre controladoria (não muda aqui). */
  admin: boolean;
  papel: PapelVistagem;
  /** Só no jurídico: as áreas que a pessoa vista (vazia = não vê nenhuma publicação). */
  areas: string[];
  /** Só no jurídico: vista as demandas de risco, isto é, recebe as de risco na fila A vistar (na controladoria, sempre). */
  veRisco: boolean;
  /** Áreas em que a pessoa está cadastrada como vistadora, pelo nome (para conferir com as áreas marcadas). */
  vistadorEm: VistadorEm[];
}

/** O que a tela manda ao salvar o acesso de uma pessoa. */
export interface PedidoDeAcesso {
  papel: PapelVistagem;
  areas: string[];
  risco: boolean;
}

/** Valida o pedido: papel conhecido, só áreas do sistema e, no jurídico, ao menos uma área. */
export function lerPedidoDeAcesso(corpo: unknown): PedidoDeAcesso {
  const dados = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const papel = dados.papel === "juridico" ? "juridico" : dados.papel === "controladoria" ? "controladoria" : null;
  if (!papel) throw new VistagemError("Escolha o papel na Vistagem: controladoria ou jurídico.");
  if (papel === "controladoria") return { papel, areas: [], risco: true };
  const pedidas = Array.isArray(dados.areas) ? dados.areas : [];
  const areas = ESCRITORIOS.filter((area) => pedidas.includes(area));
  if (!areas.length) throw new VistagemError("Marque ao menos uma área que a pessoa vista.");
  // Demanda de risco só se restringe no jurídico; sem a marcação explícita de "não", vê.
  return { papel, areas, risco: dados.risco !== false };
}

/** Áreas (e tipos) em que o nome aparece na lista de vistadores; compara sem acento e também pelo nome do RH. */
export function ondeVista(nome: string, mapa: MapaDeVistadores): VistadorEm[] {
  const procurado = chaveNome(nome);
  if (!procurado) return [];
  const ehAPessoa = (vistador: string) => chaveNome(vistador) === procurado || chaveNome(nomeNoRh(vistador)) === procurado;
  const resultado: VistadorEm[] = [];
  for (const area of [...ESCRITORIOS, TODAS_AS_AREAS_VISTAGEM]) {
    const tipos = TIPOS_DE_DEMANDA.filter((tipo) => vistadoresDa(area, tipo, mapa).some(ehAPessoa));
    if (tipos.length) resultado.push({ area, tipos });
  }
  return resultado;
}

/**
 * O que não bate entre o acesso e a lista de vistadores: no jurídico, área em que a pessoa vista sem estar marcada,
 * ou vistador de risco marcado para não vistar as demandas de risco; e jurídico sem área nenhuma.
 */
export function avisosDoAcesso(acesso: Pick<AcessoVistagem, "papel" | "areas" | "veRisco" | "vistadorEm">): string[] {
  if (acesso.papel !== "juridico") return [];
  const avisos: string[] = [];
  if (!acesso.areas.length) avisos.push("Sem área marcada: não vê nenhuma publicação.");
  const faltando = acesso.vistadorEm.filter((item) => item.area !== TODAS_AS_AREAS_VISTAGEM && !acesso.areas.includes(item.area));
  if (faltando.length) {
    const nomes = faltando.map((item) => item.area);
    avisos.push(`Vistador em ${nomes.join(", ")}, mas ${nomes.length === 1 ? "essa área não está marcada" : "essas áreas não estão marcadas"}.`);
  }
  if (!acesso.veRisco && acesso.vistadorEm.some((item) => item.tipos.includes("risco"))) {
    avisos.push("Vistador de demandas de risco, mas está marcado para não vistar as de risco.");
  }
  return avisos;
}

/** Jurídico primeiro (é quem tem recorte), depois a controladoria; dentro de cada um, pelo nome. */
export function ordenarAcessos(acessos: AcessoVistagem[]): AcessoVistagem[] {
  return [...acessos].sort(
    (a, b) => Number(b.papel === "juridico") - Number(a.papel === "juridico") || a.nome.localeCompare(b.nome, "pt-BR")
  );
}
