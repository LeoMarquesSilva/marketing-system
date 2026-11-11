import type { OrigemPrazo } from "./agendamento";
import type { AlteracaoDaVistagem } from "./alterar-vistagem";
import type { ContagemPrazo } from "./dias-uteis";
import type { TarefaNoVios } from "./fila-vios";
import type { FluxoDaTarefa } from "./fluxo-vios";
import type { ResultadoSugestao, SugestaoIa } from "./sugestao-ia";
import type { SugestaoTriagem } from "./sugestao-triagem";
import type { PastaSioe, Pendencia } from "./triagem";

/** Situação da publicação no fluxo de vistagem (captura → vistagem → agendamento → revisão). */
export type PublicacaoStatus =
  | "captada"
  | "duplicidade"
  | "descartada"
  | "triagem_pendente"
  | "juridico_vistar"
  | "controladoria_vistar"
  | "pronto_para_agendar"
  | "agendado"
  | "checado"
  | "revisar"
  /** Sem pasta no VIOS: a vistagem virou pedido de abertura de pasta na Central do SharePoint. */
  | "abertura_pasta";

export type DuplicidadeResultado = "confirmada" | "nao_duplicidade";

export type DuplicidadeCriterio = "texto" | "id_documento";

/** Uma linha da aba "Publicações" do xlsx diário da Kurier. */
export interface KurierLinha {
  /** Número da linha no Excel (1 = primeira linha da planilha). */
  linha: number;
  dataDivulgacao: string | null;
  dataPublicacao: string | null;
  numeroProcesso: string;
  estado: string;
  diario: string;
  nomeLocalizado: string;
  caderno: string;
  comarca: string;
  titulo: string;
  /** PUBLICAÇÃO + CONTINUAÇÃO PUBLICAÇÃO 1..N, sem cortes. */
  teor: string;
}

export interface ProcessoNormalizado {
  /** Número CNJ com máscara (NNNNNNN-DD.AAAA.J.TR.OOOO). */
  cnj: string | null;
  /** Os 20 dígitos do CNJ, usados para cruzar com o VIOS. */
  digitos: string | null;
  /** Complemento após o CNJ (ex.: "5000" em 2197342-77.2026.8.26.0000/5000). */
  sufixo: string | null;
}

export type Justica = "estadual" | "trabalhista" | "federal" | "superior";

export interface TribunalNormalizado {
  sigla: string;
  justica: Justica | null;
}

export interface DjenParte {
  nome: string;
  polo: string;
  idComunicacao: number | null;
}

export interface DjenAdvogado {
  nome: string;
  oab: string;
  uf: string;
}

/** Campos do cabeçalho estruturado das comunicações do DJEN. */
export interface DjenDados {
  idComunicacao: number | null;
  orgao: string | null;
  dataDisponibilizacao: string | null;
  tipoComunicacao: string | null;
  tribunal: string | null;
  intimados: string[];
  partes: DjenParte[];
  advogados: DjenAdvogado[];
  /** Texto da decisão sem os blocos de partes/advogados e sem a linha "Intimado(s) / Citado(s)". */
  corpo: string;
}

// ---------------------------------------------------------------------------
// Respostas das rotas (o que a tela recebe)
// ---------------------------------------------------------------------------

export interface ArquivoKurierResumo {
  id: string;
  nomeArquivo: string;
  dataArquivo: string;
  lote: number;
  /** "colado": publicações coladas de e-mail ou Teams (Captura › Colar publicações). */
  origem: "sharepoint" | "upload" | "colado";
  status: "processando" | "processado" | "erro";
  erro: string | null;
  totalLinhas: number;
  totalCaptadas: number;
  totalDuplicidades: number;
  totalDescartadas: number;
  recebidoEm: string;
  processadoEm: string | null;
}

export interface PublicacaoResumo {
  id: string;
  linhaArquivo: number | null;
  numeroProcesso: string | null;
  numeroProcessoOriginal: string;
  tribunal: string | null;
  justica: Justica | null;
  dataDivulgacao: string | null;
  dataPublicacao: string | null;
  /** Dia do lote da Kurier (ou da colagem) em que a publicação entrou: o filtro "Data da importação". */
  dataImportacao: string | null;
  nomeLocalizado: string | null;
  djenIdComunicacao: number | null;
  djenOrgao: string | null;
  djenTipoComunicacao: string | null;
  djenIntimados: string[];
  status: PublicacaoStatus;
  motivoDescarte: string | null;
  duplicidadeDe: string | null;
  duplicidadeResultado: DuplicidadeResultado | null;
  duplicidadeCriterio: DuplicidadeCriterio | null;
  documentoIds: string[];
  /** Triagem com o SIOE. */
  pastaCi: string | null;
  pastaVinculo: string | null;
  cliente: string | null;
  grupoCliente: string | null;
  advogadoResponsavel: string | null;
  situacaoProcesso: string | null;
  /** Ação, fase processual e valor da ação da pasta no VIOS (retrato da triagem, pelo SIOE). */
  acaoProcesso: string | null;
  faseProcessual: string | null;
  valorAcao: number | null;
  valorAcaoAtualizado: number | null;
  escritorioResponsavel: string | null;
  demandaRisco: boolean | null;
  pendencia: Pendencia | null;
  pastasCandidatas: PastaSioe[];
  triadaEm: string | null;
  /** Vistagem do jurídico e conferência da controladoria. */
  observacaoVistagem: string | null;
  vistadoEm: string | null;
  conferidoEm: string | null;
  devolucaoMotivo: string | null;
  devolvidoEm: string | null;
  /** Vistada de novo depois da devolução (vistadoEm continua sendo a primeira vistagem). */
  revistadoEm: string | null;
  /** Reaberta por quem vistou para alterar antes da Conferência (pedido de 11/11/2026). */
  reabertaEm?: string | null;
  checadoEm: string | null;
  checkNota: string | null;
  /** Última transferência para a fila de outra área (escritório de origem, quando e por quê). */
  transferidoDe: string | null;
  transferidoEm: string | null;
  transferenciaMotivo: string | null;
  /** Trabalhista: classificação eSocial escolhida na vistagem (não vai para o VIOS; mesmos valores da BKP). */
  publicacaoEsocial: string | null;
  /** Pedido de abertura de pasta na Central do SharePoint: o item criado e, se não chegou, o erro. */
  centralItemId: string | null;
  centralEnviadaEm: string | null;
  centralErro: string | null;
  /** Sem pasta no VIOS: dados sugeridos (processo citado, parte cliente ou IA) para a controladoria conferir. */
  sugestaoTriagem: SugestaoTriagem | null;
  teor: string;
  /** true quando `teor` foi encurtado na listagem. */
  teorResumido: boolean;
}

export interface DuplicidadeItem {
  duplicidade: PublicacaoResumo;
  principal: PublicacaoResumo | null;
  dataArquivo: string | null;
  revisadaPor: string | null;
  revisadaEm: string | null;
}

export interface TriagemResumo {
  triadas: number;
  juridico: number;
  pendentes: number;
  descartadas: number;
  porEscritorio: Record<string, number>;
  erro?: string;
}

export interface SincronizacaoResultado {
  verificados: number;
  importados: number;
  resultados: { nome: string; situacao: "importado" | "ja_importado" | "erro"; mensagem?: string }[];
  triagem?: TriagemResumo;
}

export interface PendenciasControladoria {
  pendentes: PublicacaoResumo[];
  exClientes: PublicacaoResumo[];
}

/** Resolução de uma pendência: CI escolhida e/ou dados informados pela controladoria. */
export interface ResolucaoPendencia {
  ci?: string;
  escritorio?: string;
  grupo?: string;
  demandaRisco?: boolean;
}

/** Publicação pronta para gravar, ainda sem ids do banco. */
export interface PublicacaoCapturada {
  linha: number;
  dataDivulgacao: string | null;
  dataPublicacao: string | null;
  numeroProcessoOriginal: string;
  processo: ProcessoNormalizado;
  estado: string;
  diario: string;
  tribunal: TribunalNormalizado;
  nomeLocalizado: string;
  caderno: string;
  comarca: string;
  titulo: string;
  teor: string;
  djen: DjenDados | null;
  chaveDecisao: string | null;
  /** Ids de documento do PJe citados no texto. */
  documentoIds: string[];
  status: Extract<PublicacaoStatus, "captada" | "duplicidade" | "descartada">;
  motivoDescarte: string | null;
  /** Linha da publicação principal quando esta é duplicidade dentro do mesmo arquivo. */
  duplicidadeDeLinha: number | null;
  /** Como a duplicidade foi reconhecida: mesmo texto ou mesmo Id de documento. */
  duplicidadeCriterio: DuplicidadeCriterio | null;
}

// ---------------------------------------------------------------------------
// Vistagem do jurídico e conferência
// ---------------------------------------------------------------------------

export type EnvioStatus = "nao_enviado" | "pendente" | "enviado" | "processando" | "concluido" | "erro";

/**
 * O que o jurídico escolheu para uma tarefa do fluxo (o robô grava no VIOS depois de lançar): a data e/ou os
 * responsáveis. Sem a data, vale a do VIOS; sem os responsáveis, a regra do robô (`quemFicaNoFluxo`).
 */
export interface DataDoFluxo {
  /** Tipos desde a tarefa agendada até esta (ex.: ["EMBARGOS DE DECLARAÇÃO", "2. REVISAR"]). */
  caminho: string[];
  /** AAAA-MM-DD; ausente quando só os responsáveis mudaram. */
  data?: string;
  /** Nomes dos usuários do VIOS; ausente quando só a data mudou. */
  responsaveis?: string[];
}

/** Tarefa que o fluxo automático do VIOS cria com a tarefa agendada, e quem o robô coloca nela. */
export interface TarefaPrevista {
  nome: string;
  caminho: string[];
  /** 1: criada pela agendada; 2: criada por uma do fluxo (Embargos › 2. REVISAR)… */
  nivel: number;
  /** AAAA-MM-DD que vai ficar no VIOS (a escolhida pelo jurídico, ou a do VIOS); null: o VIOS data sozinho. */
  data: string | null;
  /** A que o VIOS dá pela regra dele (sem as mudanças do jurídico). */
  dataVios: string | null;
  /** O jurídico escolheu esta data. */
  editada: boolean;
  /**
   * O Orquestra mudou a data que o VIOS daria, e o robô grava no VIOS: "fatal", Revisar/Protocolar apertado para
   * caber antes da fatal (prazo curto a partir de hoje); "hoje", a regra do VIOS dava antes de hoje.
   */
  ajustada?: "fatal" | "hoje";
  /** 1. CIÊNCIA DOS AGENDAMENTOS repetida na vistagem: o robô cancela no VIOS (fica a da primeira tarefa). */
  repetida?: boolean;
  responsaveis: string;
  /** O jurídico escolheu quem fica (no lugar da regra do robô); os nomes vão para o robô. */
  responsaveisEscolhidos?: string[];
  /** Com a escolha do jurídico: quem ficaria pela regra do robô. */
  responsaveisPadrao?: string;
  /** criacao: o VIOS cria junto com a tarefa; conclusao: quando ela for concluída. */
  quando: "criacao" | "conclusao";
  /** Classe do tipo no VIOS pelas etiquetas (cor no fluxo); ausente ou null quando não foi lida. */
  classe?: "PRAZO" | "PROVIDENCIA" | "COMPROMISSO" | null;
}

/** Uma mudança feita na Conferência, em texto de tela ("Data fatal", "20/11/2026", "24/11/2026"). */
export interface MudancaNaTarefa {
  campo: string;
  de: string;
  para: string;
}

/** Ajuste da controladoria numa tarefa, sem devolver ao jurídico: quem fez, quando e o que mudou. */
export interface AjusteNaTarefa {
  por: string | null;
  em: string;
  mudancas: MudancaNaTarefa[];
}

export interface AgendamentoResumo {
  id: string;
  ordem: number;
  etiqueta: "PRAZO" | "PROVIDENCIA" | "COMPROMISSO";
  tarefa: string;
  tarefaId: string | null;
  /** Data da tarefa no VIOS (no Prazo, o Enviar = fatal − 3 dias úteis). */
  data: string;
  dataFatal: string | null;
  diasPrazo: number | null;
  /** Contagem do atalho de dias (úteis/corridos); null sem atalho. */
  contagemPrazo: ContagemPrazo | null;
  /** Prazo: de onde vieram os dias ou a fatal (botões, calendário…); null nas antigas e fora do Prazo. */
  origemPrazo: OrigemPrazo | null;
  /** COMPROMISSO: horário HH:MM. */
  hora: string | null;
  /** COMPROMISSO: Hora final HH:MM (null nos antigos: o robô pôs 1 hora depois, ou 00:00 antes de 05/11/2026). */
  horaFim: string | null;
  /** SESSÃO DE JULGAMENTO: data limite no VIOS (AAAA-MM-DD); nos outros tipos e nas antigas, null (é a própria data). */
  dataLimite: string | null;
  responsavel: string;
  revisor: string | null;
  observacao: string | null;
  /** Como ficou no VIOS: a tarefa pedida e as que o fluxo criou, com as datas agendadas. */
  viosTarefas: TarefaNoVios[] | null;
  /** Datas do fluxo escolhidas pelo jurídico (o robô grava no VIOS). */
  fluxoDatas: DataDoFluxo[];
  /** O que o fluxo do VIOS vai criar junto e ao concluir (só a lista da Conferência traz). */
  fluxoPrevisto?: TarefaPrevista[];
  /**
   * Prazo apertado (só a lista da Conferência traz): o Enviar vistado já passou (ou é hoje e o prazo é curto) e o robô
   * lança com este, o de hoje, apertando o Revisar e o Protocolar antes da fatal. Null quando vai o Enviar vistado.
   */
  enviarHoje?: string | null;
  /** Ajustes feitos na Conferência; sem nenhum, a tarefa está como o jurídico vistou. */
  ajustes?: AjusteNaTarefa[];
  envioStatus: EnvioStatus;
  envioSimulado: boolean | null;
  viosTarefaId: string | null;
  envioErro: string | null;
  enviadoEm: string | null;
}

export interface CatalogoVistagem {
  area: string;
  atualizadoEm: string;
  /** `nome` é único na lista (nome repetido no VIOS ganha o tipo); `nomeVios` é o nome original. */
  tarefas: Record<"PRAZO" | "PROVIDENCIA" | "COMPROMISSO", { id: string; nome: string; nomeVios?: string; responsaveis?: string[] }[]>;
  usuarios: { id: string; nome: string }[];
}

/** Opção de um campo de escolha do cadastro de processo no VIOS (Matéria, Sistema do Tribunal). */
export interface MateriaVios {
  id: string;
  nome: string;
}

/**
 * Pedido de "Atualizar cadastro no VIOS" para a pasta: o parágrafo da síntese, a Matéria e/ou o Sistema do Tribunal
 * (cada um opcional; o robô grava os três de uma vez).
 */
export interface SintesePedida {
  id: string;
  texto: string;
  autor: string | null;
  /** Dia do pedido (DD/MM/AAAA), que vai no começo do parágrafo. */
  data: string;
  status: "pendente" | "enviado" | "processando" | "concluido" | "erro";
  erro: string | null;
  simulado: boolean;
  /** O robô achou o parágrafo já na síntese e não gravou de novo. */
  jaEstava: boolean;
  /** Matéria escolhida no pedido: o robô preenche ou troca a do VIOS. */
  materias: MateriaVios[];
  /** Sistema do Tribunal escolhido no pedido: o robô troca o do VIOS. */
  sistemaTribunal: MateriaVios | null;
  criadoEm: string;
}

export interface VistagemDetalhe {
  publicacao: PublicacaoResumo;
  agendamentos: AgendamentoResumo[];
  catalogo: CatalogoVistagem | null;
  /** Por que não há lista de tarefas (catálogo indisponível ou área sem catálogo). */
  catalogoErro: string | null;
  responsavelSugerido: string | null;
  /** Auxiliar da pasta no VIOS (sugerido como revisor do Prazo). */
  revisorSugerido: string | null;
  /** Foto do advogado da pasta e dos usuários do VIOS, pela chave do nome (chaveNome); só quem tem foto. */
  fotos: Record<string, string>;
  /**
   * Quem aparece em Responsável e Revisor: os usuários do VIOS das áreas da publicação (RH e liderança em Usuários),
   * sócios, quem não tem área conhecida e as pessoas da pasta. Null = sem filtro (a lista inteira do VIOS).
   */
  pessoasDaArea: { area: string; nomes: string[] } | null;
  /** Área de cada usuário do VIOS pelo RH (ex.: "Cível"), pela chave do nome; aparece ao mostrar todas as pessoas. */
  areaDasPessoas: Record<string, string>;
  inconsistencias: InconsistenciaResumo[];
  /** Síntese do processo da pasta no VIOS (via SIOE). Null sem pasta ou com a síntese em branco. */
  sintese: string | null;
  /** Por que a síntese não pôde ser carregada. */
  sinteseErro: string | null;
  /** Parágrafos pedidos ao robô para esta pasta (os 10 mais novos). */
  sintesesPedidas: SintesePedida[];
  /** A pasta está sem Matéria na base do SIOE: o VIOS não grava o cadastro sem ela. */
  materiaVazia: boolean;
  /** Matéria da pasta na base do SIOE, como veio do relatório do VIOS (null sem ela). */
  materiaAtual: string | null;
  /** Opções do campo Matéria do VIOS (o jurídico pode preencher ou trocar). */
  materiasVios: MateriaVios[];
  /** A pasta está sem Sistema do Tribunal na base do SIOE (o VIOS não grava o cadastro sem ele). */
  sistemaVazio: boolean;
  /** Sistema do Tribunal da pasta na base do SIOE (null sem ele ou sem a coluna ainda). */
  sistemaAtual: string | null;
  /** Opções do campo Sistema do Tribunal do VIOS. */
  sistemasVios: MateriaVios[];
  /** Feriados (AAAA-MM-DD) para contar os dias úteis do Prazo na tela. */
  feriados: string[];
  /** Fluxo automático do VIOS por id do tipo de tarefa (só os que criam algo). */
  fluxos: Record<string, FluxoDaTarefa>;
  /** Por que o fluxo do VIOS não pôde ser carregado. */
  fluxosErro: string | null;
  /**
   * Reestruturação: usuários do VIOS com cargo de estagiário no RH do Orquestra. Na Ciência dos Agendamentos que o
   * Orquestra cria, o revisor fica no lugar deles. Vazio nas outras áreas.
   */
  estagiarios: string[];
  /** Pasta do Trabalhista: pede a classificação eSocial. Null nas outras áreas. */
  esocial: {
    /** Tipo Inserir E-social na lista de Providências da área; null se o VIOS ainda não tem. */
    tarefa: { id: string; nome: string } | null;
    /** Larissa, se for usuária do VIOS na área. */
    responsavelSugerido: string | null;
  } | null;
  /** Sugestão da IA já gerada (Trabalhista). */
  sugestaoIa: SugestaoIa | null;
  /** A área tem sugestão da IA e a chave da OpenAI está configurada: a tela pede a sugestão se ainda não houver. */
  sugestaoIaDisponivel: boolean;
  hoje: string;
}

/** Resultado de criar o pedido na Central do SharePoint: o id do item ou o erro (o cron tenta de novo). */
export interface ResultadoCentral {
  itemId: string | null;
  erro: string | null;
}

export interface ConferenciaItem {
  publicacao: PublicacaoResumo;
  /** Área da pasta no VIOS: decide o que o fluxo automático cria (os tipos disponíveis para a área). */
  areaProcesso: string | null;
  agendamentos: AgendamentoResumo[];
  inconsistencias: InconsistenciaResumo[];
  /** Quem vistou primeiro (quem analisou a publicação; a devolução volta para essa pessoa). */
  vistadoPor: string | null;
  /** Quem devolveu ao jurídico na última devolução da conferência. */
  devolvidoPor: string | null;
  /** Quem vistou de novo depois da devolução. */
  revistadoPor: string | null;
  conferidoPor: string | null;
  /** Quem deu o check (só as listas do Check trazem). */
  checadoPor?: string | null;
  /** Auxiliar da pasta no VIOS, para a ficha da conferência e do check (só essas listas trazem). */
  auxiliar?: string | null;
  /** Sugestão da IA que o jurídico tinha na vistagem e o que fez com ela (só a conferência traz; null sem sugestão). */
  sugestaoIa?: SugestaoNaVistagem | null;
  /** Só na visão Vistado do jurídico, antes da Conferência: se quem vê pode reabrir a vistagem para alterar e, se não, por quê. */
  alteracao?: AlteracaoDaVistagem;
}

export interface SugestaoNaVistagem {
  sugestao: SugestaoIa;
  /** Se o jurídico usou como veio, alterou ou não usou; null quando a vistagem não registrou. */
  resultado: ResultadoSugestao | null;
  /** Data fatal de cada tarefa sugerida, na ordem (só PRAZO; null quando não dá para calcular). */
  fatais: (string | null)[];
}

export interface ConferenciaResposta {
  aConferir: ConferenciaItem[];
  enviadas: ConferenciaItem[];
  /** Sem pasta no VIOS: vistagens que foram para a Central do SharePoint como abertura de pasta. */
  aberturas: ConferenciaItem[];
  envioSimulado: boolean;
  /** Foto do advogado, do auxiliar e das pessoas das tarefas (e do fluxo), pela chave do nome (chaveNome); só quem tem foto. */
  fotos: Record<string, string>;
  /** AAAA-MM-DD em São Paulo, para a régua de datas. */
  hoje: string;
}

export interface InconsistenciaResumo {
  id: string;
  origem: "juridico" | "agendamento";
  tipo: string;
  subtipo: string | null;
  descricao: string;
  criadoPor: string | null;
  criadoEm: string;
  contestacao: string | null;
  contestadoPor: string | null;
  contestadoEm: string | null;
  excluidaEm: string | null;
  excluidaPor: string | null;
  motivoExclusao: string | null;
}

export interface InconsistenciaItem {
  inconsistencia: InconsistenciaResumo;
  publicacao: PublicacaoResumo;
}

export interface CheckResposta {
  aChecar: ConferenciaItem[];
  revisar: ConferenciaItem[];
  checadas: ConferenciaItem[];
  /** Foto de quem vistou, conferiu e checou, do advogado, do auxiliar e das pessoas das tarefas, pela chave do nome. */
  fotos: Record<string, string>;
  /** AAAA-MM-DD em São Paulo, para a régua de datas. */
  hoje: string;
}

/** Visão "Agendadas" do jurídico: o que foi vistado nos últimos `dias` e onde está cada tarefa. */
export interface AgendadasJuridicoResposta {
  itens: ConferenciaItem[];
  /** Foto de quem vistou, conferiu e checou, do advogado e das pessoas das tarefas, pela chave do nome. */
  fotos: Record<string, string>;
  /** AAAA-MM-DD em São Paulo. */
  hoje: string;
  dias: number;
}
