"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudUpload, LoaderCircle, Play, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { isAdminRole } from "@/lib/access-control";
import { DURACAO_PADRAO, ROTULO_TIPO, type PessoaPauta, type TipoAudiencia } from "@/lib/audiencias/tipos";
import { cn } from "@/lib/utils";
import { Aviso, Carregando, Painel, PainelTopo, Secao, Selo, campoClasse } from "../vistagem/ui";
import { AcessoPauta, Avatar, mensagemDeErro, pautaApi, quando, type DadosDaPauta } from "./comum";

interface Config {
  duracoes: Partial<Record<TipoAudiencia, number>>;
  whatsapp: { ligado: boolean; grupo: string | null; instancia: string | null };
  outlook: { ligado: boolean; organizador: string | null };
  tribunais: string[];
}

const TIPOS_DURACAO: TipoAudiencia[] = ["una", "inicial", "conciliacao", "instrucao", "pericia", "julgamento", "sessao"];

export function ConfiguracoesClient() {
  return (
    <AcessoPauta>
      <Configuracoes />
    </AcessoPauta>
  );
}

function Configuracoes() {
  const { profile } = useAuth();
  const admin = isAdminRole(profile);
  const [pessoas, setPessoas] = useState<PessoaPauta[] | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [modos, setModos] = useState<{ outlook: string; whatsapp: string } | null>(null);
  const [leituras, setLeituras] = useState<DadosDaPauta["leituras"]>([]);
  const [aviso, setAviso] = useState<{ tom: "sucesso" | "erro" | "info"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const [p, c, d] = await Promise.all([
        pautaApi.get<{ pessoas: PessoaPauta[] }>("/pessoas"),
        pautaApi.get<{ config: Config; modos: { outlook: string; whatsapp: string } }>("/config"),
        pautaApi.get<DadosDaPauta>(`?de=${new Date().toISOString().slice(0, 10)}&ate=${new Date().toISOString().slice(0, 10)}`),
      ]);
      setPessoas(p.pessoas);
      setConfig(c.config);
      setModos(c.modos);
      setLeituras(d.leituras);
    } catch (e) {
      setAviso({ tom: "erro", texto: mensagemDeErro(e) });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function acao(nome: string, fazer: () => Promise<string>) {
    setOcupado(nome);
    setAviso(null);
    try {
      setAviso({ tom: "sucesso", texto: await fazer() });
    } catch (e) {
      setAviso({ tom: "erro", texto: mensagemDeErro(e) });
    } finally {
      setOcupado(null);
    }
  }

  async function salvarPessoa(id: string, campos: Partial<PessoaPauta>) {
    try {
      const { pessoa } = await pautaApi.patch<{ pessoa: PessoaPauta }>("/pessoas", { id, ...campos });
      setPessoas((lista) => (lista ?? []).map((p) => (p.id === id ? pessoa : p)));
    } catch (e) {
      setAviso({ tom: "erro", texto: mensagemDeErro(e) });
    }
  }

  if (!pessoas || !config) return <Carregando rotulo="Carregando as configurações" />;

  return (
    <div className="space-y-4">
      {!admin ? <Aviso tom="info">Só administradores mudam estas configurações. Você pode consultar.</Aviso> : null}
      {aviso ? <Aviso tom={aviso.tom}>{aviso.texto}</Aviso> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Painel>
          <PainelTopo titulo={`Equipe da pauta (${pessoas.length})`} descricao="Nome como o VIOS escreve, e-mail para o convite e WhatsApp para a marcação no grupo.">
            {admin ? (
              <Button
                size="xs"
                variant="outline"
                disabled={ocupado === "semear"}
                onClick={() =>
                  void acao("semear", async () => {
                    const r = await pautaApi.post<{ novas: number; total: number }>("/pessoas");
                    await carregar();
                    return r.novas ? `${r.novas} pessoa(s) trazida(s) do cadastro do VIOS.` : "A equipe trabalhista já está toda na pauta.";
                  })
                }
              >
                {ocupado === "semear" ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                Trazer a equipe do VIOS
              </Button>
            ) : null}
          </PainelTopo>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[#e6eef0] bg-[#f7fbfc] text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Nome no VIOS</th>
                  <th className="px-2 py-2 font-medium">E-mail</th>
                  <th className="px-2 py-2 font-medium">WhatsApp</th>
                  <th className="px-2 py-2 font-medium">Faz audiência</th>
                  <th className="px-2 py-2 font-medium">Coordenação</th>
                  <th className="px-2 py-2 font-medium">Ativa</th>
                </tr>
              </thead>
              <tbody>
                {pessoas.map((p) => (
                  <LinhaPessoa key={p.id} pessoa={p} admin={admin} aoSalvar={(campos) => void salvarPessoa(p.id, campos)} />
                ))}
              </tbody>
            </table>
          </div>
        </Painel>

        <div className="space-y-4">
          <Painel>
            <PainelTopo titulo="Leituras" descricao="O robô lê a Minha Pauta do PJe; depois de cada leitura a pauta é conferida com o VIOS. A rotina confere o DJEN e manda os avisos." />
            <Secao>
              {leituras.length ? (
                <ul className="space-y-1.5 text-sm">
                  {leituras.map((l) => (
                    <li key={l.fonte + (l.tribunal ?? "")} className="flex items-center justify-between gap-2">
                      <span>
                        {l.fonte === "pje" ? `PJe ${l.tribunal ?? ""} · Minha Pauta` : l.fonte === "djen" ? "DJEN · intimações" : "VIOS · relatório de tarefas"}
                        <span className="block text-xs text-muted-foreground">{l.total} registro(s)</span>
                      </span>
                      <Selo tom={l.erro ? "perigo" : "sucesso"} titulo={l.erro ?? undefined}>
                        {l.erro ? "Erro" : quando(l.iniciadaEm)}
                      </Selo>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma leitura ainda. O robô da pauta grava aqui a cada rodada.</p>
              )}
              {admin ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <input
                    ref={arquivo}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      void acao("vios", async () => {
                        const r = await pautaApi.enviarArquivo<{ vios: { lidas: number; conferidas: number; divergentes: number; soNoVios: number } }>(f);
                        await carregar();
                        return `${r.vios.lidas} audiência(s) no relatório; ${r.vios.conferidas} conferida(s) com o PJe, ${r.vios.divergentes} com data diferente, ${r.vios.soNoVios} só no VIOS.`;
                      });
                    }}
                  />
                  <Button size="xs" variant="outline" onClick={() => arquivo.current?.click()} disabled={ocupado === "vios"}>
                    {ocupado === "vios" ? <LoaderCircle className="animate-spin" /> : <CloudUpload />}
                    Subir relatório do VIOS (CSV)
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={ocupado === "rotina"}
                    onClick={() =>
                      void acao("rotina", async () => {
                        await pautaApi.post("/rotina");
                        await carregar();
                        return "Rotina rodada: conferência com o VIOS, DJEN, convites e avisos do horário.";
                      })
                    }
                  >
                    {ocupado === "rotina" ? <LoaderCircle className="animate-spin" /> : <Play />}
                    Rodar a rotina agora
                  </Button>
                </div>
              ) : null}
            </Secao>
          </Painel>
          <ConfigAvisos key={JSON.stringify(config)} config={config} modos={modos} admin={admin} aoSalvar={(c) =>
              void acao("config", async () => {
                setConfig((await pautaApi.put<{ config: Config }>("/config", c)).config);
                return "Configuração salva.";
              })
            }
          />
        </div>
      </div>
    </div>
  );
}

function LinhaPessoa({ pessoa, admin, aoSalvar }: { pessoa: PessoaPauta; admin: boolean; aoSalvar: (campos: Partial<PessoaPauta>) => void }) {
  const [email, setEmail] = useState(pessoa.email ?? "");
  const [whatsapp, setWhatsapp] = useState(pessoa.whatsapp ?? "");
  const alterado = email !== (pessoa.email ?? "") || whatsapp !== (pessoa.whatsapp ?? "");
  const chave = (campo: "fazAudiencia" | "coordenacao" | "ativo") => (
    <input type="checkbox" className="size-4 accent-[#347796]" checked={pessoa[campo]} disabled={!admin} onChange={(e) => aoSalvar({ [campo]: e.target.checked })} aria-label={campo} />
  );
  return (
    <tr className={cn("border-b border-[#e6eef0] last:border-b-0", !pessoa.ativo && "opacity-60")}>
      <td className="px-4 py-2">
        <span className="flex items-center gap-2">
          <Avatar pessoa={pessoa} />
          <span className="min-w-0">
            <span className="block truncate">{pessoa.nomeVios}</span>
            <span className="block text-xs text-muted-foreground">{pessoa.cargo ?? "—"}</span>
          </span>
        </span>
      </td>
      <td className="px-2 py-2">
        <input className={cn(campoClasse, "h-8 w-48")} value={email} disabled={!admin} onChange={(e) => setEmail(e.target.value)} placeholder="nome@…" aria-label="E-mail" />
      </td>
      <td className="px-2 py-2">
        <span className="flex items-center gap-1.5">
          <input className={cn(campoClasse, "h-8 w-36")} value={whatsapp} disabled={!admin} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(19) 9…" aria-label="WhatsApp" />
          {alterado && admin ? (
            <Button size="icon-xs" variant="secondary" aria-label="Salvar" onClick={() => aoSalvar({ email: email || null, whatsapp: whatsapp || null })}>
              <Save />
            </Button>
          ) : null}
        </span>
      </td>
      <td className="px-2 py-2">{chave("fazAudiencia")}</td>
      <td className="px-2 py-2">{chave("coordenacao")}</td>
      <td className="px-2 py-2">{chave("ativo")}</td>
    </tr>
  );
}

function ConfigAvisos({ config, modos, admin, aoSalvar }: { config: Config; modos: { outlook: string; whatsapp: string } | null; admin: boolean; aoSalvar: (c: Partial<Config>) => void }) {
  const [rascunho, setRascunho] = useState(config);
  return (
    <Painel>
      <PainelTopo titulo="Avisos e convites" descricao="O envio de verdade precisa desta chave ligada e do modo real no ambiente.">
        {admin ? (
          <Button size="xs" onClick={() => aoSalvar(rascunho)}>
            <Save />
            Salvar
          </Button>
        ) : null}
      </PainelTopo>
      <Secao titulo="WhatsApp no grupo da área">
        <label className="flex items-center justify-between gap-3 text-sm">
          Mandar avisos no grupo
          <input type="checkbox" className="size-4 accent-[#347796]" disabled={!admin} checked={rascunho.whatsapp.ligado} onChange={(e) => setRascunho({ ...rascunho, whatsapp: { ...rascunho.whatsapp, ligado: e.target.checked } })} />
        </label>
        <input
          className={cn(campoClasse, "h-9 w-full")}
          disabled={!admin}
          placeholder="Identificador do grupo (…@g.us)"
          value={rascunho.whatsapp.grupo ?? ""}
          onChange={(e) => setRascunho({ ...rascunho, whatsapp: { ...rascunho.whatsapp, grupo: e.target.value || null } })}
        />
        <p className="text-xs text-muted-foreground">Ambiente: {modos?.whatsapp === "real" ? "envio real" : modos?.whatsapp === "off" ? "desligado" : "modo teste (registra sem enviar)"}</p>
      </Secao>
      <Secao titulo="Convites no Outlook">
        <label className="flex items-center justify-between gap-3 text-sm">
          Mandar convites para titular e backup
          <input type="checkbox" className="size-4 accent-[#347796]" disabled={!admin} checked={rascunho.outlook.ligado} onChange={(e) => setRascunho({ ...rascunho, outlook: { ...rascunho.outlook, ligado: e.target.checked } })} />
        </label>
        <input
          className={cn(campoClasse, "h-9 w-full")}
          disabled={!admin}
          placeholder="Caixa organizadora (padrão: a da controladoria)"
          value={rascunho.outlook.organizador ?? ""}
          onChange={(e) => setRascunho({ ...rascunho, outlook: { ...rascunho.outlook, organizador: e.target.value || null } })}
        />
        <p className="text-xs text-muted-foreground">Ambiente: {modos?.outlook === "real" ? "envio real" : "modo teste (registra sem enviar)"}</p>
      </Secao>
      <Secao titulo="Duração padrão (para os choques de horário)">
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_DURACAO.map((t) => (
            <label key={t} className="flex items-center justify-between gap-2 text-sm">
              {ROTULO_TIPO[t]}
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={10}
                  max={600}
                  step={10}
                  disabled={!admin}
                  className={cn(campoClasse, "h-8 w-20 text-right")}
                  value={rascunho.duracoes[t] ?? DURACAO_PADRAO[t]}
                  onChange={(e) => setRascunho({ ...rascunho, duracoes: { ...rascunho.duracoes, [t]: Number(e.target.value) } })}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </span>
            </label>
          ))}
        </div>
      </Secao>
    </Painel>
  );
}
