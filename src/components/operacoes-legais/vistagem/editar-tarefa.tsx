"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, LoaderCircle, Pencil, Save, TriangleAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { avisosDaData, chaveDoCaminho, contagemPadraoDaPublicacao, horaFinalPadrao, horaValida, pedeDataLimite, revisorFicaNaTarefa } from "@/lib/vistagem/agendamento";
import { mudancasNaTarefa, type CamposDaTarefa } from "@/lib/vistagem/ajuste-conferencia";
import { ROTULO_CONTAGEM, criarCalendario, criarCalendarioDePrazo, datasDoPrazo, noRecessoForense } from "@/lib/vistagem/dias-uteis";
import { caminhosDoFluxo, fluxoDoPrazo, fluxoPrevisto, prazoApertado } from "@/lib/vistagem/fluxo-previsto";
import { CADEIA_PADRAO, cadeiaDoFluxo, semPrazoProprio } from "@/lib/vistagem/fluxo-vios";
import { fataisDoFluxo } from "@/lib/vistagem/prazo-legal";
import type { AgendamentoResumo, DataDoFluxo, VistagemDetalhe } from "@/lib/vistagem/types";
import { CampoData, CampoHora } from "./campo-data";
import { ComboboxBusca } from "./combobox-busca";
import { DialogoAcao } from "./dialogo-acao";
import { BlocoTarefa, CampoResponsaveis, FluxoNoVios, classeNoCatalogo, comMudancaNoFluxo, pessoasDoDetalhe } from "./juridico-client";
import { formatarData } from "./publicacao-ui";
import { ListaDeMudancas } from "./tarefas-conferencia";
import { Aviso, Carregando } from "./ui";

interface Formulario {
  /** No Prazo com fatal, o Enviar; nas outras tarefas, a data no VIOS. */
  data: string;
  dataFatal: string;
  hora: string;
  horaFim: string;
  /** SESSÃO DE JULGAMENTO: data limite no VIOS. Vazia = a mesma data, e acompanha quando ela muda. */
  dataLimite: string;
  responsavel: string;
  revisor: string;
  /** O que foi mudado no Fluxo do VIOS, pela chave do caminho. */
  fluxoDatas: Record<string, DataDoFluxo>;
}

/**
 * O lápis da Conferência: ajusta data, horário e responsáveis da tarefa e das que o fluxo do VIOS cria com ela, sem
 * devolver ao jurídico. Grava na própria tarefa, que é o que o robô lê ao validar (ou ao rodar de novo, depois de um
 * erro). As listas de pessoas e os fluxos vêm dos mesmos dados da vistagem, e o servidor aplica as mesmas regras dela.
 */
export function EditarTarefa({
  publicacaoId,
  processo,
  tarefa,
  comEnvio,
  dados,
  onDados,
  onFechar,
  onSalva,
}: {
  publicacaoId: string;
  processo: string;
  tarefa: AgendamentoResumo;
  /** Aba Enviadas ao robô: a tarefa deu erro, e a alteração vai quando rodar de novo. */
  comEnvio: boolean;
  dados: VistagemDetalhe | null;
  onDados: (dados: VistagemDetalhe) => void;
  onFechar: () => void;
  onSalva: (mensagem: string) => Promise<void>;
}) {
  const [erroAoCarregar, setErroAoCarregar] = useState("");
  useEffect(() => {
    if (dados) return;
    let cancelado = false;
    authFetch(`/api/operacoes-legais/vistagem/juridico/${publicacaoId}`)
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar os dados da tarefa.");
        if (!cancelado) onDados(corpo as VistagemDetalhe);
      })
      .catch((e) => !cancelado && setErroAoCarregar(e instanceof Error ? e.message : "Falha ao carregar os dados da tarefa."));
    return () => {
      cancelado = true;
    };
  }, [dados, onDados, publicacaoId]);

  const titulo = "Editar tarefa";
  const descricao = (
    <>
      {tarefa.tarefa} · <span className="tabular-nums">{processo}</span>
    </>
  );
  if (!dados) {
    return (
      <DialogoAcao
        aberto
        onFechar={onFechar}
        ocupado={false}
        icone={Pencil}
        titulo={titulo}
        descricao={descricao}
        rodape={
          <Button variant="outline" onClick={onFechar}>
            Fechar
          </Button>
        }
      >
        {erroAoCarregar ? <Aviso tom="erro">{erroAoCarregar}</Aviso> : <Carregando rotulo="Carregando as pessoas e o fluxo da tarefa" />}
      </DialogoAcao>
    );
  }
  return (
    <FormularioDaTarefa publicacaoId={publicacaoId} tarefa={tarefa} comEnvio={comEnvio} dados={dados} titulo={titulo} descricao={descricao} onFechar={onFechar} onSalva={onSalva} />
  );
}

function FormularioDaTarefa({
  publicacaoId,
  tarefa,
  comEnvio,
  dados,
  titulo,
  descricao,
  onFechar,
  onSalva,
}: {
  publicacaoId: string;
  tarefa: AgendamentoResumo;
  comEnvio: boolean;
  dados: VistagemDetalhe;
  titulo: string;
  descricao: ReactNode;
  onFechar: () => void;
  onSalva: (mensagem: string) => Promise<void>;
}) {
  const { hoje } = dados;
  const fluxoDoTipo = tarefa.tarefaId ? dados.fluxos[tarefa.tarefaId] ?? null : null;
  const ehDiaUtil = useMemo(() => criarCalendario(dados.feriados), [dados.feriados]);
  const contaPrazo = useMemo(() => criarCalendarioDePrazo(dados.feriados), [dados.feriados]);
  const pessoas = useMemo(() => pessoasDoDetalhe(dados), [dados]);
  const classeDe = useMemo(() => classeNoCatalogo(dados.catalogo), [dados.catalogo]);

  const prazo = tarefa.etiqueta === "PRAZO";
  // A SENTENÇA é de Prazo (exige revisor), mas leva só a data dela.
  const comFatal = prazo && !semPrazoProprio(fluxoDoTipo);
  const compromisso = tarefa.etiqueta === "COMPROMISSO";
  const comRevisor = tarefa.etiqueta !== "PROVIDENCIA";
  // SESSÃO DE JULGAMENTO: a data limite no VIOS pode ir além da data (a tarefa guarda o nome como está no VIOS).
  const comLimite = pedeDataLimite(tarefa.tarefa);
  // Corridos na Insolvência e nas pastas RC-Insolvência, como na vistagem.
  const contagemDaArea = contagemPadraoDaPublicacao(dados.publicacao.escritorioResponsavel ?? dados.catalogo?.area, dados.publicacao.etiquetas);
  // Regra da insolvência: só antecipa o Enviar com prazo marcado de 10 dias ou mais. Os dias da vistagem valem enquanto
  // a fatal for a mesma; mudada aqui, conta da publicação até a nova (como o servidor ao gravar).
  const fluxoPara = (dataFatal: string | null) =>
    fluxoDoPrazo(
      fluxoDoTipo,
      { dataFatal, diasPrazo: dataFatal === tarefa.dataFatal ? tarefa.diasPrazo : null },
      { dataPublicacao: dados.publicacao.dataPublicacao, contagem: contagemDaArea, ehDiaDePrazo: contaPrazo }
    );

  // Validada noutro dia, com prazo curto, o Enviar que vai para o VIOS é o de hoje (como no robô): a tela mostra esse.
  const [dataInicial] = useState(() => prazoApertado(tarefa, fluxoPara(tarefa.dataFatal), ehDiaUtil, hoje)?.enviar ?? tarefa.data);
  const [inicial] = useState<Formulario>(() => ({
    data: dataInicial,
    dataFatal: tarefa.dataFatal ?? "",
    hora: tarefa.hora ?? "",
    horaFim: tarefa.horaFim ?? horaFinalPadrao(tarefa.hora),
    dataLimite: tarefa.dataLimite && tarefa.dataLimite !== tarefa.data ? tarefa.dataLimite : "",
    responsavel: tarefa.responsavel,
    revisor: tarefa.revisor ?? "",
    fluxoDatas: Object.fromEntries(tarefa.fluxoDatas.map((item) => [chaveDoCaminho(item.caminho), item])),
  }));
  const [form, setForm] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const alterar = (mudanca: Partial<Formulario>) => setForm((atual) => ({ ...atual, ...mudanca }));

  const enviarPelaFatal = (fatal: string) => datasDoPrazo(fatal, ehDiaUtil, dados.fluxosErro ? CADEIA_PADRAO : cadeiaDoFluxo(fluxoPara(fatal)), hoje).enviar;
  const enviarDaConta = comFatal && form.dataFatal ? enviarPelaFatal(form.dataFatal) : null;
  const enviarAMao = Boolean(enviarDaConta && form.data && form.data !== enviarDaConta);

  // Só o que o fluxo deste tipo cria (uma data antiga de tarefa que saiu do fluxo não trava o salvamento).
  const caminhos = useMemo(() => caminhosDoFluxo(fluxoDoTipo), [fluxoDoTipo]);
  const campos = (valor: Formulario): CamposDaTarefa => ({
    data: valor.data,
    dataFatal: comFatal ? valor.dataFatal || null : null,
    hora: compromisso ? valor.hora || null : null,
    horaFim: compromisso ? valor.horaFim || null : null,
    dataLimite: comLimite ? valor.dataLimite || valor.data || null : null,
    responsavel: valor.responsavel,
    revisor: comRevisor ? valor.revisor || null : null,
    fluxoDatas: Object.values(valor.fluxoDatas).filter((item) => dados.fluxosErro || caminhos.has(chaveDoCaminho(item.caminho))),
  });
  const mudancas = mudancasNaTarefa(campos(inicial), campos(form));

  const fluxo = fluxoPara(form.dataFatal || null);
  const apertada = comFatal && form.dataFatal ? prazoApertado({ etiqueta: tarefa.etiqueta, dataFatal: form.dataFatal, data: form.data }, fluxo, ehDiaUtil, hoje) : null;
  const dataNoVios = apertada?.enviar ?? form.data;
  // A Ciência repetida o servidor já marcou, olhando as outras tarefas da vistagem: o robô cancela, e ela não se edita.
  const repetidas = new Set((tarefa.fluxoPrevisto ?? []).filter((item) => item.repetida).map((item) => chaveDoCaminho(item.caminho)));
  const previstas = fluxo
    ? fluxoPrevisto({ data: dataNoVios, responsavel: form.responsavel, revisor: form.revisor || null }, fluxo, ehDiaUtil, {
        hoje,
        datas: Object.values(form.fluxoDatas),
        apertada,
      }).map((item) => (item.quando === "criacao" && repetidas.has(chaveDoCaminho(item.caminho)) ? { ...item, repetida: true } : item))
    : [];

  const horaFimOk = !form.horaFim || (horaValida(form.horaFim) && form.horaFim > form.hora);
  const limiteOk = !comLimite || !form.dataLimite || !form.data || form.dataLimite >= form.data;
  const completo =
    limiteOk &&
    Boolean(form.responsavel.trim()) &&
    (comFatal ? Boolean(form.dataFatal && form.data) : Boolean(form.data)) &&
    (!prazo || Boolean(form.revisor)) &&
    (!compromisso || (horaValida(form.hora) && horaFimOk));

  // Prazo apertado: o Enviar vistado já passou e o formulário abre com o de hoje (é o que o robô lança).
  const enviarVistadoPassou = comFatal && dataInicial !== tarefa.data && tarefa.data < hoje;
  const avisos = [
    ...(enviarVistadoPassou && form.data === dataInicial
      ? [`O Enviar vistado (${formatarData(tarefa.data)}) já passou: vai hoje (${formatarData(dataInicial)}), com o Revisar e o Protocolar antes da fatal.`]
      : []),
    ...(comFatal && form.dataFatal
      ? [
          ...avisosDaData(form.dataFatal, hoje).map((texto) => `Data fatal: ${texto.toLowerCase()}`),
          ...(contaPrazo(form.dataFatal) ? [] : [noRecessoForense(form.dataFatal) ? "A data fatal cai no recesso forense (20/12 a 20/01)." : "A data fatal não é dia útil."]),
        ]
      : []),
    ...(form.data ? avisosDaData(form.data, hoje).map((texto) => `${comFatal ? "Enviar" : "Data"}: ${texto.toLowerCase()}`) : []),
    ...(comFatal && form.dataFatal && form.data > form.dataFatal ? ["O Enviar não pode ficar depois da data fatal."] : []),
    ...(comFatal && form.dataFatal && previstas.some((item) => item.quando === "criacao" && !item.repetida && item.data && item.data > form.dataFatal)
      ? ["Há tarefa do fluxo depois da data fatal: confira as datas abaixo."]
      : []),
  ];

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const pedido = campos(form);
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/conferencia/${publicacaoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O Enviar que não mudou vai como está gravado: o de hoje, do prazo curto, é só o que o robô vai receber.
        body: JSON.stringify({ acao: "editar", agendamentoId: tarefa.id, ...pedido, data: form.data === dataInicial ? tarefa.data : form.data }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao salvar a alteração.");
      await onSalva(
        corpo.mudancas === 0
          ? "Nada mudou nesta tarefa."
          : comEnvio
            ? `${tarefa.tarefa}: alteração salva. Rode novamente para o robô lançar assim.`
            : `${tarefa.tarefa}: alteração salva. Vai para o robô ao validar.`
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar a alteração.");
      setSalvando(false);
    }
  }

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={Pencil}
      titulo={titulo}
      descricao={descricao}
      className="sm:max-w-3xl"
      // No rodapé, o erro aparece mesmo com a pessoa no topo de um fluxo comprido.
      aviso={
        erro ? (
          <span role="alert" className="font-medium text-red-700">
            {erro}
          </span>
        ) : mudancas.length ? (
          `${mudancas.length === 1 ? "1 alteração" : `${mudancas.length} alterações`}: ${comEnvio ? "vai para o robô ao rodar de novo." : "vai para o robô ao validar."}`
        ) : (
          "Altere a data ou o responsável. Fica registrado quem mudou."
        )
      }
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !mudancas.length || !completo}>
            {salvando ? <LoaderCircle className="animate-spin" /> : <Save />}
            Salvar alteração
          </Button>
        </>
      }
    >
      <BlocoTarefa titulo={comFatal ? "Prazo" : compromisso ? "Data e horário" : "Data"} icone={CalendarDays}>
        <div className="flex flex-wrap items-start gap-3">
          {comFatal ? (
            <div className="w-[11rem] space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">Data fatal</span>
              <CampoData
                rotulo="Data fatal"
                valor={form.dataFatal}
                ehDiaUtil={contaPrazo}
                invalido={!form.dataFatal}
                // O Enviar segue a conta do fluxo da tarefa, como na vistagem.
                onChange={(dataFatal) => alterar({ dataFatal, ...(dataFatal ? { data: enviarPelaFatal(dataFatal) } : {}) })}
              />
            </div>
          ) : null}
          <div className="w-[11rem] space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">{comFatal ? "Enviar (data no VIOS)" : "Data no VIOS"}</span>
            <CampoData
              rotulo={comFatal ? "Enviar: data no VIOS" : "Data no VIOS"}
              valor={form.data}
              ehDiaUtil={ehDiaUtil}
              invalido={!form.data}
              destacado={enviarAMao}
              // A data limite igual à data acompanha a data; a escolhida fica.
              onChange={(data) => alterar({ data, ...(form.dataLimite && form.dataLimite === form.data ? { dataLimite: "" } : {}) })}
            />
            {enviarAMao && enviarDaConta ? (
              <p className="text-xs text-muted-foreground">
                Pela fatal: {formatarData(enviarDaConta)}.{" "}
                <button type="button" className="font-medium text-[#347796] underline-offset-4 hover:underline" onClick={() => alterar({ data: enviarDaConta })}>
                  Usar esta
                </button>
              </p>
            ) : null}
          </div>
          {compromisso ? (
            <>
              <div className="w-32 space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">Horário</span>
                <CampoHora
                  rotulo="Horário do compromisso"
                  valor={form.hora}
                  invalido={!horaValida(form.hora)}
                  // A hora final acompanha a inicial (1 hora depois) enquanto a pessoa não mudar a final.
                  onChange={(hora) => alterar({ hora, ...(!form.horaFim || form.horaFim === horaFinalPadrao(form.hora) ? { horaFim: horaFinalPadrao(hora) } : {}) })}
                />
              </div>
              <div className="w-32 space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">Hora final</span>
                <CampoHora rotulo="Hora final do compromisso" valor={form.horaFim} invalido={!horaFimOk} onChange={(horaFim) => alterar({ horaFim })} />
              </div>
            </>
          ) : null}
          {comLimite ? (
            <div className="w-[11rem] space-y-1.5" title="Vai para a Data limite no VIOS. Começa igual à data e pode ir além dela.">
              <span className="block text-xs font-medium text-muted-foreground">Data limite</span>
              <CampoData
                rotulo="Data limite no VIOS"
                valor={form.dataLimite || form.data}
                min={form.data || undefined}
                ehDiaUtil={ehDiaUtil}
                destacado={Boolean(form.dataLimite && form.dataLimite !== form.data)}
                invalido={!limiteOk}
                onChange={(dataLimite) => alterar({ dataLimite })}
              />
            </div>
          ) : null}
        </div>
        {avisos.length ? (
          <ul className="space-y-0.5 text-xs text-amber-800">
            {avisos.map((aviso) => (
              <li key={aviso} className="flex items-center gap-1.5">
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                {aviso}
              </li>
            ))}
          </ul>
        ) : null}
      </BlocoTarefa>

      <BlocoTarefa titulo="Quem" icone={Users}>
        {/* Providência não tem revisor (nenhum tipo cria 2. REVISAR no VIOS): só o responsável. */}
        <div className={comRevisor ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Responsável</span>
            <CampoResponsaveis pessoas={pessoas} valor={form.responsavel} onChange={(responsavel) => alterar({ responsavel })} rotulo="Responsável da tarefa" />
          </div>
          {comRevisor ? (
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted-foreground">
                {prazo ? "Revisor (obrigatório)" : "Revisor (opcional)"}
                {revisorFicaNaTarefa(tarefa.tarefa, dados.publicacao.escritorioResponsavel ?? dados.catalogo?.area) ? <span className="font-normal"> · fica na tarefa, com o responsável</span> : null}
              </span>
              <ComboboxBusca
                opcoes={pessoas.opcoes}
                ampliar={pessoas.ampliar}
                pessoas
                valor={form.revisor}
                onChange={(revisor) => alterar({ revisor })}
                placeholder={prazo ? "Digite para buscar o revisor…" : "Sem revisor"}
                rotulo="Revisor da tarefa"
                permitirVazio
                invalido={prazo && !form.revisor}
              />
            </div>
          ) : null}
        </div>
      </BlocoTarefa>

      {dados.fluxosErro ? <Aviso tom="alerta">Não deu para carregar o fluxo do VIOS: as datas e os responsáveis do fluxo ficam como estão.</Aviso> : null}
      {fluxo && previstas.length ? (
        <FluxoNoVios
          previstas={previstas}
          principal={{ nome: tarefa.tarefa, data: dataNoVios || null, etiqueta: tarefa.etiqueta, responsaveis: form.responsavel }}
          fatais={
            comFatal
              ? form.dataFatal
                ? [{ rotulo: "Data fatal", data: form.dataFatal, dica: "Muda no campo Data fatal, acima." }]
                : []
              : prazo
                ? fataisDoFluxo(fluxo, dados.publicacao.dataPublicacao, dados.catalogo?.area, contagemDaArea, contaPrazo).map((fatal) => ({
                    rotulo: `Data fatal · ${fatal.nome}`,
                    data: fatal.data,
                    dica: `${fatal.dias} ${ROTULO_CONTAGEM[contagemDaArea]} após a publicação (prazo legal). Só para conferir: não vai para o VIOS.`,
                  }))
                : []
          }
          pessoas={pessoas}
          hoje={hoje}
          ehDiaUtil={ehDiaUtil}
          classeDe={classeDe}
          onMudarData={(caminho, data) => alterar({ fluxoDatas: comMudancaNoFluxo(form.fluxoDatas, caminho, { data }) })}
          onMudarResponsaveis={(caminho, nomes) => alterar({ fluxoDatas: comMudancaNoFluxo(form.fluxoDatas, caminho, { responsaveis: nomes }) })}
        />
      ) : null}

      {mudancas.length ? (
        <section className="space-y-1.5 rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2" aria-label="O que vai mudar">
          <h3 className="text-[11px] font-semibold uppercase text-[#285f7a]">O que vai mudar</h3>
          <ListaDeMudancas mudancas={mudancas} />
        </section>
      ) : null}
    </DialogoAcao>
  );
}
