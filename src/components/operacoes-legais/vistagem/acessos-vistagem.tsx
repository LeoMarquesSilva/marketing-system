"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, KeyRound, LoaderCircle, Pencil, Scale, ShieldAlert, ShieldCheck, TriangleAlert, UsersRound, X } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PapelVistagem } from "@/lib/access-control";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { avisosDoAcesso, type AcessoVistagem, type VistadorEm } from "@/lib/vistagem/acessos";
import { ESCRITORIOS } from "@/lib/vistagem/triagem";
import { TODAS_AS_AREAS_VISTAGEM } from "@/lib/vistagem/vistadores";
import { AvatarPessoa } from "./combobox-busca";
import { CartaoEditavel, Interruptor } from "./configuracoes-ui";
import { IconeArea } from "./marcas";
import { Aviso, Carregando, Selo } from "./ui";

/**
 * Quem acessa a Vistagem, o que cada pessoa enxerga (papel e áreas) e se vista as demandas de risco. Ficava em Usuários; agora
 * fica junto dos vistadores. Liberar o módulo para alguém continua em Usuários, na lista de módulos da pessoa.
 */

const ROTULO_DO_TIPO: Record<string, string> = { normal: "normais", risco: "de risco" };

/** "Cível (normais e de risco) · Trabalhista (normais)". */
function textoDeOndeVista(vistadorEm: VistadorEm[]): string {
  return vistadorEm.map((item) => `${item.area} (${item.tipos.map((tipo) => ROTULO_DO_TIPO[tipo]).join(" e ")})`).join(" · ");
}

function ChipDaArea({ area }: { area: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[#f7fbfc] py-0.5 pl-0.5 pr-2 text-xs text-foreground ring-1 ring-inset ring-[#e6eef0]">
      <IconeArea area={area} tamanho="sm" />
      <span className="truncate">{area}</span>
    </span>
  );
}

function SeloDoRisco({ veRisco }: { veRisco: boolean }) {
  return veRisco ? (
    <Selo tom="perigo" icone={ShieldAlert} className="shrink-0">
      Vista as de risco
    </Selo>
  ) : (
    <Selo tom="neutro" icone={ShieldCheck} className="shrink-0">
      Não vista as de risco
    </Selo>
  );
}

function LinhaDoJuridico({ acesso, onEditar }: { acesso: AcessoVistagem; onEditar: () => void }) {
  const avisos = avisosDoAcesso(acesso);
  return (
    <li className="py-3">
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <AvatarPessoa nome={acesso.nome} foto={acesso.foto} className="size-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground" title={acesso.nome}>
              {acesso.nome}
            </p>
            {acesso.email ? <p className="truncate text-xs text-muted-foreground">{acesso.email}</p> : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {acesso.areas.length ? acesso.areas.map((area) => <ChipDaArea key={area} area={area} />) : <span className="text-xs text-muted-foreground">Nenhuma área</span>}
          <SeloDoRisco veRisco={acesso.veRisco} />
        </div>
        <Button size="sm" variant="outline" className="justify-self-start sm:justify-self-end" onClick={onEditar} aria-label={`Editar o acesso de ${acesso.nome}`}>
          <Pencil />
          Editar
        </Button>
      </div>
      {avisos.length ? (
        <ul className="mt-2 space-y-1 sm:pl-[2.875rem]">
          {avisos.map((aviso) => (
            <li key={aviso} className="flex items-start gap-1.5 text-xs text-amber-800">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PessoaDaControladoria({ acesso, onEditar }: { acesso: AcessoVistagem; onEditar: () => void }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5 rounded-md bg-[#f7fbfc] px-2.5 py-2 ring-1 ring-inset ring-[#e6eef0]">
      <AvatarPessoa nome={acesso.nome} foto={acesso.foto} className="size-8" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={acesso.nome}>
          {acesso.nome}
        </p>
        <p className="truncate text-xs text-muted-foreground">{acesso.admin ? "Administrador: todas as abas e configurações" : "Todas as abas e áreas"}</p>
      </div>
      {acesso.admin ? (
        <Selo tom="escuro" className="shrink-0">
          admin
        </Selo>
      ) : (
        <Button size="icon-sm" variant="ghost" onClick={onEditar} aria-label={`Editar o acesso de ${acesso.nome}`} title="Editar o acesso">
          <Pencil />
        </Button>
      )}
    </li>
  );
}

function DialogoDoAcesso({
  acesso,
  salvando,
  erro,
  onFechar,
  onSalvar,
}: {
  acesso: AcessoVistagem;
  salvando: boolean;
  erro: string;
  onFechar: () => void;
  onSalvar: (pedido: { papel: PapelVistagem; areas: string[]; risco: boolean }) => void;
}) {
  const [papel, setPapel] = useState<PapelVistagem>(acesso.papel);
  const [areas, setAreas] = useState<string[]>(acesso.areas);
  const [veRisco, setVeRisco] = useState(acesso.veRisco);
  const juridico = papel === "juridico";
  const avisos = avisosDoAcesso({ papel, areas, veRisco, vistadorEm: acesso.vistadorEm });
  const alternar = (area: string) => setAreas((atuais) => (atuais.includes(area) ? atuais.filter((item) => item !== area) : [...atuais, area]));
  // Na ordem das áreas do sistema (a mesma do cartão de vistadores).
  const marcadas = ESCRITORIOS.filter((area) => areas.includes(area));

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && !salvando && onFechar()}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl" onOpenAutoFocus={(evento) => evento.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Acesso à Vistagem</DialogTitle>
          <DialogDescription className="sr-only">Papel, áreas e demandas de risco de {acesso.nome} na Vistagem.</DialogDescription>
          <div className="flex items-center gap-3 pt-1">
            <AvatarPessoa nome={acesso.nome} foto={acesso.foto} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{acesso.nome}</p>
              {acesso.email ? <p className="truncate text-xs text-muted-foreground">{acesso.email}</p> : null}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Segmented<PapelVistagem>
              label="Papel na Vistagem"
              value={papel}
              options={[
                { value: "controladoria", label: "Controladoria", icon: Eye },
                { value: "juridico", label: "Jurídico", icon: Scale },
              ]}
              onChange={setPapel}
            />
            <p className="text-xs text-muted-foreground">
              {juridico
                ? "Vê a Visão geral e a aba Vistagem, só com as publicações das áreas marcadas."
                : "Vê todas as abas e todas as áreas, inclusive as demandas de risco."}
            </p>
          </div>

          {juridico ? (
            <>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-[#285f7a]">Áreas que vista</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {ESCRITORIOS.map((area) => {
                    const marcada = areas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        aria-pressed={marcada}
                        onClick={() => alternar(area)}
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm outline-none transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-[#47cdd0]",
                          marcada ? "border-[#347796]/40 bg-[#e8f8f8] text-foreground" : "border-[#e6eef0] text-muted-foreground hover:bg-[#f7fbfc]"
                        )}
                      >
                        <IconeArea area={area} tamanho="sm" />
                        <span className="min-w-0 flex-1 truncate">{area}</span>
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded border",
                            marcada ? "border-[#347796] bg-[#347796] text-white" : "border-input bg-white"
                          )}
                          aria-hidden
                        >
                          {marcada ? <Check className="size-3" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!marcadas.length ? <p className="text-xs text-red-700">Marque ao menos uma área: sem área, a pessoa não vê nenhuma publicação.</p> : null}
              </fieldset>

              <div className="flex items-start gap-3 rounded-md border border-[#e6eef0] px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-red-50 text-red-700" aria-hidden>
                  <ShieldAlert className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Vista as demandas de risco</p>
                  <p className="text-xs text-muted-foreground">Desligado, a fila A vistar traz só as publicações sem risco; as de risco ficam com quem vista risco. Para ver (Vistado, Visão geral, Histórico), não muda nada: vê tudo das áreas marcadas.</p>
                </div>
                <Interruptor ligado={veRisco} onChange={setVeRisco} rotulo="Vista as demandas de risco" />
              </div>
            </>
          ) : null}

          {acesso.vistadorEm.length ? (
            <div className="flex items-start gap-2 rounded-md bg-[#f7fbfc] px-3 py-2 text-xs text-muted-foreground ring-1 ring-inset ring-[#e6eef0]">
              <UsersRound className="mt-px size-3.5 shrink-0 text-[#347796]" aria-hidden />
              <span>
                Na lista de vistadores:{" "}
                <span className="text-foreground">
                  {textoDeOndeVista(acesso.vistadorEm.map((item) => (item.area === TODAS_AS_AREAS_VISTAGEM ? { ...item, area: "todas as áreas" } : item)))}
                </span>
                .
              </span>
            </div>
          ) : null}
          {avisos.length && marcadas.length ? (
            <Aviso tom="alerta">
              {avisos.map((aviso) => (
                <span key={aviso} className="block">
                  {aviso}
                </span>
              ))}
            </Aviso>
          ) : null}
          {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => onSalvar({ papel, areas: marcadas, risco: !juridico || veRisco })} disabled={salvando || (juridico && !marcadas.length)}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null}
            Salvar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuemAcessaAVistagem() {
  const [acessos, setAcessos] = useState<AcessoVistagem[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState<AcessoVistagem | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroAoSalvar, setErroAoSalvar] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/configuracoes/acessos");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível carregar quem acessa a Vistagem.");
      setAcessos(corpo as AcessoVistagem[]);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar quem acessa a Vistagem.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(pedido: { papel: PapelVistagem; areas: string[]; risco: boolean }) {
    if (!editando) return;
    setSalvando(true);
    setErroAoSalvar("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/configuracoes/acessos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: editando.id, ...pedido }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Não foi possível salvar o acesso.");
      setAcessos(corpo as AcessoVistagem[]);
      setAviso(`Acesso de ${editando.nome} salvo. Os dados valem na hora; o menu da pessoa muda quando ela recarregar a página.`);
      setEditando(null);
    } catch (falha) {
      setErroAoSalvar(falha instanceof Error ? falha.message : "Não foi possível salvar o acesso.");
    } finally {
      setSalvando(false);
    }
  }

  const { juridico, controladoria } = useMemo(
    () => ({
      juridico: (acessos ?? []).filter((acesso) => acesso.papel === "juridico"),
      controladoria: (acessos ?? []).filter((acesso) => acesso.papel === "controladoria"),
    }),
    [acessos]
  );
  const abrir = (acesso: AcessoVistagem) => {
    setErroAoSalvar("");
    setAviso("");
    setEditando(acesso);
  };

  return (
    <CartaoEditavel
      icone={KeyRound}
      titulo="Quem acessa a Vistagem"
      descricao="O que cada pessoa enxerga: a controladoria vê todas as abas e áreas; o jurídico vê a Visão geral e a aba Vistagem, só das áreas marcadas. A marca de risco só decide quem vista as demandas de risco."
      acao={
        <Button asChild size="sm" variant="outline" className="shrink-0" title="Liberar ou tirar o módulo de alguém é na lista de módulos da pessoa, em Usuários">
          <Link href="/usuarios">Liberar em Usuários</Link>
        </Button>
      }
      rodape={
        <p className="text-xs text-muted-foreground">
          Liberar ou tirar a Vistagem de alguém continua em Usuários (lista de módulos da pessoa). Aqui fica o que ela enxerga dentro da Vistagem.
        </p>
      }
    >
      {aviso ? (
        <Aviso
          tom="sucesso"
          className="mb-3"
          acao={
            <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setAviso("")}>
              <X />
            </Button>
          }
        >
          {aviso}
        </Aviso>
      ) : null}
      {erro && !acessos ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => void carregar()}>
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : !acessos ? (
        <Carregando rotulo="Carregando quem acessa a Vistagem" />
      ) : (
        <div className="space-y-5">
          <section aria-labelledby="acessos-juridico">
            <div className="flex items-baseline justify-between gap-3">
              <h4 id="acessos-juridico" className="text-xs font-semibold uppercase text-[#285f7a]">
                Jurídico <span className="font-normal normal-case text-muted-foreground">· {juridico.length} {juridico.length === 1 ? "pessoa" : "pessoas"}</span>
              </h4>
              <span className="hidden text-xs text-muted-foreground sm:inline">Visão geral e aba Vistagem, só das áreas marcadas</span>
            </div>
            {juridico.length ? (
              <ul className="divide-y divide-[#eef3f5]">
                {juridico.map((acesso) => (
                  <LinhaDoJuridico key={acesso.id} acesso={acesso} onEditar={() => abrir(acesso)} />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">Ninguém com o papel de jurídico ainda.</p>
            )}
          </section>

          <section aria-labelledby="acessos-controladoria">
            <h4 id="acessos-controladoria" className="mb-2 text-xs font-semibold uppercase text-[#285f7a]">
              Controladoria <span className="font-normal normal-case text-muted-foreground">· {controladoria.length} {controladoria.length === 1 ? "pessoa" : "pessoas"}</span>
            </h4>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {controladoria.map((acesso) => (
                <PessoaDaControladoria key={acesso.id} acesso={acesso} onEditar={() => abrir(acesso)} />
              ))}
            </ul>
          </section>
        </div>
      )}

      {editando ? (
        <DialogoDoAcesso
          key={editando.id}
          acesso={editando}
          salvando={salvando}
          erro={erroAoSalvar}
          onFechar={() => setEditando(null)}
          onSalvar={(pedido) => void salvar(pedido)}
        />
      ) : null}
    </CartaoEditavel>
  );
}
