import { MOTIVO_INDICE } from "./captura";
import { DIAS_PRAZO, DIAS_PRAZO_TRABALHISTA } from "./dias-uteis";
import { ESOCIAL_COM_TAREFA, RESPONSAVEL_ESOCIAL, TAREFA_ESOCIAL } from "./esocial";
import { PESSOA_FIXA_PROTOCOLAR } from "./fluxo-vios";
import { SUBTIPOS_AGENDAMENTO_EM_USO, TIPOS_INCONSISTENCIA_JURIDICO } from "./inconsistencias";
import { ESCRITORIOS, ESCRITORIO_EX_CLIENTE } from "./triagem";

/**
 * As regras da Vistagem em linguagem de quem usa (Vistagem › Configurações), na ordem da esteira. Os valores vêm
 * das mesmas constantes que o código usa, para a tela não mentir quando a regra mudar. As que o admin altera ficam
 * em `configuracoes.ts`; aqui estão as fixas, com de onde cada uma vem.
 */

/** De onde a regra vem (e, portanto, onde ela muda). */
export type OrigemDaRegra = "codigo" | "vios" | "sioe" | "servidor" | "configuravel";

export const ORIGEM_DA_REGRA: Record<OrigemDaRegra, { rotulo: string; dica: string }> = {
  configuravel: { rotulo: "Editável aqui", dica: "Muda nesta tela; vale a partir da próxima rodada." },
  codigo: { rotulo: "Fixa no sistema", dica: "Muda com um ajuste no código do Orquestra." },
  vios: { rotulo: "Vem do VIOS", dica: "Segue o cadastro do VIOS (fluxos, tarefas, usuários): muda lá." },
  sioe: { rotulo: "Vem do SIOE", dica: "Segue o SIOE (pastas, áreas das pessoas, feriados): muda lá." },
  servidor: { rotulo: "Variável do servidor", dica: "Ligada na Vercel: muda com a configuração do servidor (pedir ao suporte)." },
};

/** Número que a tela mostra ao lado da regra (últimos 30 dias), calculado em `configuracoes-server.ts`. */
export type MetricaDaRegra =
  | "arquivos"
  | "duplicidadesTexto"
  | "duplicidadesDocumento"
  | "descartesIndice"
  | "descartesExCliente"
  | "descartesManuais"
  | "triadasAutomaticas"
  | "resolvidasNaTriagem"
  | "demandasDeRisco"
  | "devolucoes"
  | "checadas";

export interface RegraDocumentada {
  id: string;
  titulo: string;
  /** "Quando…" */
  quando: string;
  /** "…então" */
  entao: string;
  origem: OrigemDaRegra;
  metrica?: MetricaDaRegra;
  /** Rótulo do número ("separadas", "descartadas"…). */
  rotuloDaMetrica?: string;
}

export interface EtapaDocumentada {
  id: string;
  titulo: string;
  resumo: string;
  regras: RegraDocumentada[];
}

const lista = (itens: readonly (string | number)[]) => itens.join(", ");

export const REGRAS_DA_ESTEIRA: EtapaDocumentada[] = [
  {
    id: "captura",
    titulo: "Gestão das publicações (chegada)",
    resumo: "Como o arquivo da Kurier e as publicações coladas entram no sistema.",
    regras: [
      {
        id: "cron",
        titulo: "Busca do arquivo do dia",
        quando: "for dia útil, às 7h (e de novo às 9h)",
        entao: "o sistema busca o .xlsx da Kurier na pasta do SharePoint e importa só o arquivo com a data de hoje.",
        origem: "codigo",
        metrica: "arquivos",
        rotuloDaMetrica: "arquivos importados",
      },
      {
        id: "repetido",
        titulo: "Arquivo repetido",
        quando: "o mesmo arquivo (ou outro do mesmo dia e lote) chegar de novo",
        entao: "ele não é importado outra vez. Um arquivo que deu erro pode ser reenviado.",
        origem: "codigo",
      },
      {
        id: "colar",
        titulo: "Publicações coladas",
        quando: "alguém colar publicações do e-mail ou do Teams (Recorte Digital OAB/SP ou DJEN)",
        entao: "elas seguem a mesma esteira do arquivo da Kurier (duplicidade, triagem, vistagem), até 200 por vez.",
        origem: "codigo",
      },
      {
        id: "alerta",
        titulo: "Alerta do arquivo atrasado",
        quando: "o arquivo do dia não chegar (ou falhar) até a hora configurada abaixo, em dia útil",
        entao: "aparece a faixa vermelha nas abas e, às 9h, sai um aviso no grupo de WhatsApp das automações.",
        origem: "configuravel",
      },
    ],
  },
  {
    id: "duplicidades",
    titulo: "Duplicidades e descartes",
    resumo: "O que o sistema separa sozinho antes da triagem.",
    regras: [
      {
        id: "dup-texto",
        titulo: "Mesmo despacho para várias partes",
        quando: "duas publicações forem do mesmo processo, do mesmo órgão e do mesmo dia, com o mesmo texto (os nomes das partes não contam)",
        entao: "a segunda vira duplicidade da primeira e vai para a aba Duplicidades conferir.",
        origem: "codigo",
        metrica: "duplicidadesTexto",
        rotuloDaMetrica: "separadas",
      },
      {
        id: "dup-documento",
        titulo: "Mesmo documento do PJe",
        quando: "duas publicações do mesmo processo e do mesmo dia citarem o mesmo Id de documento do PJe",
        entao: "a segunda vira duplicidade (só dentro do mesmo arquivo).",
        origem: "codigo",
        metrica: "duplicidadesDocumento",
        rotuloDaMetrica: "separadas",
      },
      {
        id: "dup-anterior",
        titulo: "Publicação que já chegou antes",
        quando: "a publicação for igual a uma que já entrou em outro dia",
        entao: "ela vira duplicidade da anterior.",
        origem: "codigo",
      },
      {
        id: "indice",
        titulo: "Índice de advogados",
        quando: "a linha começar com \"ÍNDICE POR ADVOGADOS\"",
        entao: `é descartada: "${MOTIVO_INDICE}"`,
        origem: "codigo",
        metrica: "descartesIndice",
        rotuloDaMetrica: "descartadas",
      },
      {
        id: "ex-cliente",
        titulo: "Ex-cliente sem advogado do escritório",
        quando: "a pasta for de ex-cliente e a publicação não citar Gustavo Bismarchi Motta nem Ricardo Viscardi Pires (nome ou OAB)",
        entao: "é descartada sozinha.",
        origem: "codigo",
        metrica: "descartesExCliente",
        rotuloDaMetrica: "descartadas",
      },
      {
        id: "descarte-manual",
        titulo: "Descarte pela controladoria",
        quando: "a controladoria descartar uma pendência na Triagem Manual",
        entao: "o motivo é obrigatório e fica registrado.",
        origem: "codigo",
        metrica: "descartesManuais",
        rotuloDaMetrica: "descartadas",
      },
    ],
  },
  {
    id: "triagem",
    titulo: "Triagem",
    resumo: "Como a publicação acha a pasta e a área.",
    regras: [
      {
        id: "pasta",
        titulo: "Achar a pasta",
        quando: "a publicação tiver número de processo",
        entao: "o sistema procura a pasta no SIOE pelo número CNJ. Com várias pastas e só uma em andamento, fica com ela.",
        origem: "sioe",
        metrica: "triadasAutomaticas",
        rotuloDaMetrica: "triadas sozinhas",
      },
      {
        id: "area",
        titulo: "Escolher a área",
        quando: "a pasta for achada",
        entao: "a área é a do advogado responsável da pasta (áreas das pessoas no SIOE); sem ela, a área do processo. Reestruturação vai para Insolvência ou Cível | Insolvência.",
        origem: "sioe",
      },
      {
        id: "ex-cliente-area",
        titulo: "Ex-cliente",
        quando: "a pasta for de ex-cliente (grupo, etiqueta ou situação)",
        entao: `vai para ${ESCRITORIO_EX_CLIENTE}.`,
        origem: "codigo",
      },
      {
        id: "pendencias",
        titulo: "Pendências da Triagem Manual",
        quando: "não houver pasta, houver mais de uma, faltar a área ou faltar o grupo do cliente",
        entao: "a publicação vai para a Triagem Manual, com o motivo. A controladoria escolhe a pasta, a área e o grupo.",
        origem: "codigo",
        metrica: "resolvidasNaTriagem",
        rotuloDaMetrica: "resolvidas à mão",
      },
      {
        id: "risco",
        titulo: "Demanda de risco",
        quando: "a pasta tiver uma das etiquetas de risco (configuradas abaixo)",
        entao: "a publicação é marcada como demanda de risco: cabeçalho vermelho, filtro próprio e só vê quem vista risco.",
        origem: "configuravel",
        metrica: "demandasDeRisco",
        rotuloDaMetrica: "marcadas",
      },
      {
        id: "areas",
        titulo: "Áreas que vistam",
        quando: "a triagem decidir a área",
        entao: `ela é uma destas: ${lista(ESCRITORIOS)}.`,
        origem: "codigo",
      },
    ],
  },
  {
    id: "vistagem",
    titulo: "Vistagem (jurídico)",
    resumo: "Quem vê o quê e o que a vistagem exige.",
    regras: [
      {
        id: "quem-ve",
        titulo: "Quem vê a fila",
        quando: "a pessoa tiver o papel jurídico em Usuários",
        entao: "ela só vê a aba Vistagem, das áreas marcadas para ela; sem \"vista demanda de risco\", as de risco não aparecem.",
        origem: "codigo",
      },
      {
        id: "tarefas",
        titulo: "Tarefas da vistagem",
        quando: "a pessoa enviar a vistagem para a conferência",
        entao: "precisa de 1 a 10 tarefas da lista do VIOS da área. Prazo exige data fatal e revisor; Compromisso exige hora.",
        origem: "vios",
      },
      {
        id: "ciencia",
        titulo: "Ciência dos agendamentos",
        quando: "nenhuma tarefa (nem o fluxo do VIOS) criar a \"1. CIÊNCIA DOS AGENDAMENTOS\"",
        entao: "o sistema cria para o responsável da primeira tarefa, com a data de hoje.",
        origem: "codigo",
      },
      {
        id: "esocial",
        titulo: "eSocial (Trabalhista)",
        quando: `a classificação eSocial for ${lista(ESOCIAL_COM_TAREFA)}`,
        entao: `entra a tarefa ${TAREFA_ESOCIAL}, para ${RESPONSAVEL_ESOCIAL}.`,
        origem: "codigo",
      },
      {
        id: "transferir",
        titulo: "Transferir de área",
        quando: "o jurídico transferir a publicação",
        entao: "ela muda de área com motivo registrado; a pasta no VIOS não muda.",
        origem: "codigo",
      },
    ],
  },
  {
    id: "prazos",
    titulo: "Prazos e datas",
    resumo: "Como o sistema conta os dias.",
    regras: [
      {
        id: "dias-uteis",
        titulo: "Dias úteis",
        quando: "o prazo for em dias úteis",
        entao: "conta a partir do 1º dia útil depois da publicação, sem sábado, domingo e feriado.",
        origem: "codigo",
      },
      {
        id: "recesso",
        titulo: "Recesso forense",
        quando: "a data fatal cair entre 20/12 e 20/01",
        entao: "esses dias não contam para a fatal (CPC 220 e CLT 775-A); Enviar, Revisar e Protocolar seguem o expediente.",
        origem: "codigo",
      },
      {
        id: "corridos",
        titulo: "Dias corridos",
        quando: "a decisão disser que o prazo é em dias corridos, ou a área for Insolvência (já vem marcado Corridos)",
        entao: "conta todos os dias (menos o recesso); se vencer em dia sem expediente, passa para o próximo dia útil.",
        origem: "codigo",
      },
      {
        id: "cadeia",
        titulo: "Enviar, Revisar e Protocolar",
        quando: "a tarefa for um Prazo",
        entao: "as datas antes da fatal seguem o fluxo da tarefa no VIOS; sem fluxo, Protocolar fica 1 dia útil antes da fatal, Revisar 2 e Enviar 3.",
        origem: "vios",
      },
      {
        id: "feriados",
        titulo: "Feriados",
        quando: "o sistema contar dias úteis",
        entao: "usa os feriados da planilha da Controladoria no SIOE (só os que adiam prazo). Ano sem feriado cadastrado usa os nacionais.",
        origem: "sioe",
      },
      {
        id: "atalhos",
        titulo: "Atalhos de dias",
        quando: "a pessoa escolher o prazo pelos botões",
        entao: `aparecem ${lista(DIAS_PRAZO)} dias (no Trabalhista, ${lista(DIAS_PRAZO_TRABALHISTA)}).`,
        origem: "codigo",
      },
      {
        id: "prazo-legal",
        titulo: "Prazo legal dos recursos",
        quando: "a tarefa de Prazo escolhida for um recurso ou a resposta a um",
        entao: "os dias já vêm marcados: 15 (CPC) ou 8 no Trabalhista; embargos de declaração 5; recurso inominado 10. Dias lidos da publicação ou escolhidos à mão não são trocados.",
        origem: "codigo",
      },
    ],
  },
  {
    id: "vios",
    titulo: "Envio ao VIOS",
    resumo: "O que o robô faz depois da conferência.",
    regras: [
      {
        id: "fluxo",
        titulo: "Fluxo das tarefas",
        quando: "a tarefa tiver fluxo no VIOS",
        entao: `o VIOS cria as tarefas do fluxo junto. Revisar fica com o revisor; Protocolar com o responsável e ${PESSOA_FIXA_PROTOCOLAR}.`,
        origem: "vios",
      },
      {
        id: "robo",
        titulo: "Robô de agendamento",
        quando: "a controladoria validar a vistagem na Conferência",
        entao: "as tarefas vão para a fila do robô, que grava no VIOS a cada 2 minutos. O modo (simulação ou gravando) está no topo desta tela.",
        origem: "servidor",
      },
      {
        id: "agendado",
        titulo: "Publicação agendada",
        quando: "todas as tarefas da publicação forem gravadas no VIOS",
        entao: "ela vai para a aba Check.",
        origem: "codigo",
      },
    ],
  },
  {
    id: "conferencia",
    titulo: "Conferência e Check",
    resumo: "Como a controladoria confere.",
    regras: [
      {
        id: "devolver",
        titulo: "Devolver ao jurídico",
        quando: "a controladoria achar erro na vistagem",
        entao: `devolve com um destes tipos: ${lista(TIPOS_INCONSISTENCIA_JURIDICO)}. A publicação volta para a fila do jurídico.`,
        origem: "codigo",
        metrica: "devolucoes",
        rotuloDaMetrica: "devolvidas",
      },
      {
        id: "check",
        titulo: "Check do agendamento",
        quando: "a tarefa já estiver no VIOS",
        entao: `o sistema compara o pedido com o VIOS (data, hora, responsável, fluxo). Erro é registrado como ${lista(SUBTIPOS_AGENDAMENTO_EM_USO)}.`,
        origem: "codigo",
        metrica: "checadas",
        rotuloDaMetrica: "checadas",
      },
    ],
  },
];

/** Como cada IA funciona, para a tela de transparência. */
export interface IaDocumentada {
  id: "tarefa" | "triagem";
  titulo: string;
  oQueFaz: string;
  quandoRoda: string[];
  oQueVe: string[];
  regras: string[];
  nuncaFaz: string[];
}

export const IAS_DA_VISTAGEM: IaDocumentada[] = [
  {
    id: "tarefa",
    titulo: "Sugestão de tarefas (Trabalhista)",
    oQueFaz: "Lê a publicação e sugere a tarefa do VIOS, o prazo (dias e contagem), o compromisso e a classificação eSocial. O advogado usa, muda ou ignora.",
    quandoRoda: [
      "No cron das 7h e das 9h, para as publicações com o advogado que ainda não têm sugestão (até 2 min e meio por rodada).",
      "Ao abrir uma publicação que ainda não tem sugestão.",
      "Só no Trabalhista: as outras áreas precisam de instruções próprias.",
      "Depois de gerada, a sugestão fica guardada e não é refeita.",
    ],
    oQueVe: [
      "Data, tribunal, órgão e tipo da publicação.",
      "O cliente do escritório e as partes (os intimados do DJEN ficam de fora).",
      "O texto da publicação, até 20 mil caracteres.",
      "A lista de tarefas do VIOS do Trabalhista.",
    ],
    regras: [
      "O escritório em regra defende as reclamadas: primeiro decide de quem é o prazo (cliente, as duas partes, a parte contrária ou ninguém).",
      "Prazo da parte contrária vira só CIÊNCIA NF.",
      "Prazos legais de referência: recursos e contrarrazões 8 dias, embargos de declaração 5, manifestação sem prazo 5; em dias úteis (CLT 775), corridos só se a decisão disser.",
      "Escolhe a tarefa só da lista do VIOS; tarefa fora da lista é descartada.",
    ],
    nuncaFaz: [
      "Não envia nada ao VIOS: só sugere na tela.",
      "Não obedece instruções escritas no texto da publicação.",
      "Não cria a tarefa INSERIR E-SOCIAL (essa vem da classificação).",
    ],
  },
  {
    id: "triagem",
    titulo: "Sugestão de pasta (Triagem Manual)",
    oQueFaz: "Para publicação sem pasta, sugere o cliente, o grupo, a área e o processo principal. A controladoria confere e decide.",
    quandoRoda: [
      "No cron das 7h e das 9h (até 1 min por rodada) e no botão \"Rodar triagem agora\".",
      "Antes da IA, o sistema tenta sozinho: outro número de processo citado no texto que já tem pasta, ou uma parte que já é cliente.",
      "A IA só entra quando essas duas buscas não acham nada.",
    ],
    oQueVe: [
      "Número do processo, tribunal e órgão.",
      "As partes e os intimados.",
      "O texto da publicação, até 12 mil caracteres.",
      "A lista de grupos com processo ativo (até 4 clientes de cada).",
    ],
    regras: [
      "Justiça do Trabalho → Trabalhista; recuperação judicial, falência e habilitação → Insolvência; ação cível contra empresa em recuperação → Cível | Insolvência; fiscal → Tributário; cobrança do cliente → Recuperação de Crédito; o resto → Cível.",
      "Grupo só da lista; sem grupo, a confiança vira baixa.",
      "Demanda de risco só se o texto disser.",
    ],
    nuncaFaz: [
      "Não resolve a pendência sozinha: a controladoria sempre confirma.",
      "Não inventa grupo fora da lista do SIOE.",
    ],
  },
];
