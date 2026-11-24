# Pauta de Audiências: plano e estado (passagem de bastão)

Módulo de Operações Legais que substitui a pauta de audiências da área trabalhista feita à mão em Excel.
Branch `feat/pauta-audiencias`, saída do `main` de 18/11/2026. Este arquivo diz o que já está pronto, como
testar e o que falta, na ordem.

> Repositório público: nenhum nome de cliente, de pessoa, número de processo, telefone, e-mail ou identificador
> de grupo entra no código, nos testes ou nos documentos. Tudo isso fica no banco ou no ambiente.

## Por quê

Em 16/11/2026 uma audiência trabalhista foi perdida por esquecimento. Hoje a audiência existe no VIOS, um estagiário
a copia para uma planilha (tarefa "INSERIR PAUTA + ATUALIZAR SISTEMA"), uma reunião diária decide quem vai, e
redesignação ou cancelamento vira texto na planilha. Ninguém é avisado.

## Decisões já tomadas

- A pauta sai do Excel. A fonte principal é o tribunal: a **Minha Pauta** do PJe da Justiça do Trabalho, lida por um
  robô com o login do advogado (só leitura).
- O **DJEN** (API pública de intimações) completa: link da sala que o PJe não tem, modalidade e conferência de data.
- O **VIOS** confere: data e situação de cada audiência no relatório de tarefas.
- Toda audiência tem **titular e backup**. O padrão vem da dupla da pasta no VIOS (titular = advogado responsável,
  backup = auxiliar). A reunião diária troca quando precisa; toda troca tem motivo e fica no histórico.
- **Convite no Outlook** para o titular (ocupado) e para o backup (livre, "[BACKUP]" no título), saindo da caixa da
  controladoria.
- **Aviso no grupo de WhatsApp** da área, marcando titular e backup: pauta de hoje (7h), pauta do próximo dia útil
  (17h), troca, mudança no tribunal e alertas para a coordenação.
- Quem usa: advogados, coordenação e controladoria (liberação própria em Usuários, fora do "só admin" de Operações
  Legais). Configurações só para admin.
- Tudo de envio começa em **modo teste** (registra o que mandaria, sem enviar).

## O que já está na branch

| Parte | Onde |
|---|---|
| Banco (não aplicado) | `supabase/migrations/20261118190000_audiencias.sql`: `aud_pessoas`, `aud_audiencias`, `aud_historico`, `aud_leituras`, `aud_convites`, `aud_avisos`, `aud_config`. RLS ligado, sem policy, só service role. |
| Regras puras (com testes) | `src/lib/audiencias/`: `pje.ts` (lê a Minha Pauta, liga redesignações, acha mudanças), `djen.ts` (lê a frase da designação: hora, modalidade, link), `agenda.ts` (Brasília, dias úteis, choque, deslocamento, alertas, opções de troca), `duplas.ts`, `mensagens.ts` (WhatsApp com menção), `outlook.ts` (evento do Graph e versão), `vios-csv.ts` (relatório de tarefas). |
| Servidor | `leitura-server.ts` (grava a leitura do PJe), `conferencia-server.ts` (DJEN e VIOS), `pauta-server.ts` (pauta, distribuição, troca, completar, conferir), `avisos-server.ts`, `convites-server.ts`, `rotina-server.ts`, `pastas-server.ts` (dupla da pasta e equipe), `config-server.ts`. |
| Rotas | `src/app/api/operacoes-legais/pauta/**`, `src/app/api/robos/pauta` (robô, `ROBO_AUTOS_TOKEN`), `src/app/api/cron/pauta-tick` (`CRON_SECRET`). |
| Telas | `/operacoes-legais/pauta` (Pauta), `/distribuicao` (reunião diária), `/tribunal` (o que mudou), `/configuracoes`. Componentes em `src/components/operacoes-legais/pauta/`. |
| Permissão e menu | `PAUTA_KEY` em `access-control.ts`, `requirePautaAccess` em `api-auth.ts`, entrada no grupo Operações Legais em `navigation.ts`, cartão em `operacoes-legais-client.tsx`. |
| Rotina | `vercel.json`: `pauta-tick` uma vez por dia (plano Hobby). A cada 10 minutos precisa do pg_cron (ver passo 7). |
| Robô do PJe | `robos/autos/src/pauta.ts` (`npm run pauta`). |
| Export do VIOS | `vios-app/index.js --audiencias` gera `Audiencias.csv`. |

Testes: `npx vitest run src/lib/audiencias` (34). Tipos e lint passavam no projeto inteiro em 18/11/2026.

> Cuidado com a máquina: nada de `next build` local; uma checagem pesada por vez
> (`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` estoura memória sem isso).

## Como as fontes viram a pauta

```
PJe "Minha Pauta" (robô, 3x ao dia, por advogado e por TRT) ─▶ POST /api/robos/pauta ─▶ aud_audiencias
   · audiência nova: dupla da pasta (SIOE processos_completo + vistagem_pastas_vios)
   · registro cancelado + novo no mesmo processo = redesignação: herda a dupla, marca tipo/horário/vara/link
   · designada que virou cancelada: "Cancelada no PJe" até alguém conferir no VIOS
rotina (pauta-tick) ─▶ DJEN por processo (link, modalidade, hora) ─▶ convites do Outlook ─▶ respostas ─▶ avisos
leitura do PJe (e "Rodar a rotina agora") ─▶ conferência com o VIOS pela cópia do SAMA (vios_tarefas, 2h e 12h)
   ─▶ vios_tarefa_ci / vios_inicio / vios_situacao / vios_conferido_em: falta, concluída, horário diferente, aberta
      com a audiência cancelada; "só no VIOS" na aba Tribunal
upload do relatório de tarefas do VIOS (Configurações) ─▶ vios_inicio / vios_situacao (diverge = vermelho)
```

O que se sabe do tribunal (testes de 18/11/2026 no TRT-15):

- A tela `pjekz/pauta-usuarios-externos` chama
  `GET /pje-comum-api/api/pauta-usuarios-externos?dataInicio=AAAA-MM-DD&dataFim=AAAA-MM-DD&codigoSituacao=M|C|R&numeroPagina&tamanhoPagina&ordenacao=asc`
  com a sessão do navegador (cookie). Devolve `{ pagina, qtdPaginas, totalRegistros, resultado }`.
- `tipo.isVirtual` vem `false` em todas: a modalidade sai da descrição ("… por videoconferência").
- A duração muitas vezes é de 1 minuto: os choques usam a duração padrão por tipo (configurável).
- Só aparecem processos em que o advogado logado está. É preciso ler a pauta de cada advogado habilitado, e o DJEN
  cobre o resto.
- O link da sala está no PJe só em parte das audiências por vídeo; o resto vem da intimação no DJEN.
- No DJEN, ler só a frase que designa a audiência: uma janela larga confundiu "plataforma" e "Resolução 345" numa
  audiência presencial.
- DataJud respondeu 429 e timeout; a pauta eletrônica pública do TRT-15 deu 403 ao acesso automático. Nenhum dos
  dois entra no fluxo.
- Login do PJe: "Entrar com PDPJ", certificado digital e código de dois fatores. O robô não digita senha; o código
  pode vir do webhook já usado pelo robô de autos (`ROBO_2FA_WEBHOOK_URL` com `?sistema=pdpj`).

## Ambiente

| Variável | Uso |
|---|---|
| `ROBO_AUTOS_TOKEN` | Robô → `/api/robos/pauta` (o mesmo do robô de autos). |
| `CRON_SECRET` | `/api/cron/pauta-tick`. |
| `SIOE_SUPABASE_URL`, `SIOE_SUPABASE_SERVICE_ROLE_KEY` | Dupla e cliente da pasta. |
| `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_MAIL_SENDER` | Convites (Graph). |
| `EVOLUTION_*` | WhatsApp (mesma instância de avisos da Vistagem; o grupo fica em Configurações). |
| `PAUTA_OUTLOOK_MODO` | `real` liga os convites de verdade (padrão: teste). |
| `PAUTA_WHATSAPP_MODO` | `real`, `simulado` (padrão) ou `off`. |
| `NEXT_PUBLIC_APP_URL` | Link "Abrir na pauta" no convite. |

O envio de verdade precisa das duas chaves: a do ambiente (`…_MODO=real`) e a da tela de Configurações (ligado).

## Próximos passos, na ordem

1. **Aplicar a migration** no Supabase de produção (pela Management API, como as outras do ORQESTRAI, registrando
   em `supabase_migrations.schema_migrations`). Precisa de ok explícito do responsável.
2. **Liberar "Pauta de Audiências"** em Usuários para a equipe trabalhista e a controladoria.
3. **Configurações → "Trazer a equipe do VIOS"**; preencher e-mail e WhatsApp de cada pessoa; marcar quem é
   coordenação e quem não faz audiência.
4. **Primeira leitura do PJe**: rodar `npm run pauta` em `robos/autos` (login do advogado). Conferir em
   Configurações → Leituras e na tela Tribunal. Se o robô travar, salvar a resposta da Minha Pauta e mandar por
   `POST /api/operacoes-legais/pauta/importacao` (JSON `{ tribunal, registros }`, admin).
5. **Conferir as telas com dados reais** (Pauta, Distribuição, Tribunal, Configurações): duplas certas, choques,
   redesignações, links. Ajustar o que aparecer.
6. **Rodar a rotina em modo teste** (Configurações → "Rodar a rotina agora") e conferir `aud_avisos` e `aud_convites`.
7. **pg_cron a cada 10 minutos** chamando `/api/cron/pauta-tick` com `Authorization: Bearer CRON_SECRET` (pg_net),
   no Supabase do ORQESTRAI ou no do SAMA, como o `orquestra-envios`.
8. **Agendador do Windows** na máquina dos robôs: `node index.js --audiencias` no `vios-app` (6h30, 11h30, 16h30) e
   `npm run pauta` no `robos/autos` (6h45, 11h45, 16h45).
9. **Falta construir:** a rotina ler o `Audiencias.csv` direto do SharePoint (`baixarArquivoPorCaminho`, site da
   Controladoria, pasta "Bases Atualizacoes"). Hoje o relatório do VIOS entra por upload em Configurações.
10. **Ligar os envios**: TI concede `Calendars.ReadWrite` (de preferência limitado à caixa da controladoria);
    `PAUTA_OUTLOOK_MODO=real` + ligar na tela; identificador do grupo de WhatsApp + `PAUTA_WHATSAPP_MODO=real` + ligar.
    Testar antes com uma audiência de teste e um grupo de teste.
11. **Etapa 3**: cobrança de aceite em D−3, reforço às 7h30 para audiências antes das 10h, aviso 30 minutos antes,
    ata não registrada em D+1, outros TRTs (`PAUTA_TRIBUNAIS=TRT15,TRT2,TRT1`), indicadores do mês e mudar a tarefa
    416 do VIOS para "completar a audiência".

## Pontos em aberto

- Quais advogados precisam ter a Minha Pauta lida (cobertura dos processos) e o consentimento de cada dono de login.
- Se um login da PDPJ abre o PJe de todos os TRTs.
- Se a sessão do PJe sobrevive entre rodadas com o navegador do robô aberto (o robô não fecha por padrão).
