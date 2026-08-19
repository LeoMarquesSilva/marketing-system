# Informar colaborador — mensagem de saldo de férias

## Objetivo

Permitir que RH e gestores/coordenadores/sócios com visão de férias gerem uma mensagem modelo (WhatsApp ou e-mail) com o saldo do colaborador, para colar e enviar fora do sistema.

## Quem usa

- **RH / editor** (`canManage`): ficha completa.
- **Viewer** (gerente, coordenador, supervisor, sócio, etc. com acesso de área): mesma ação, somente leitura da ficha.

O botão fica disponível sempre que a ficha do colaborador estiver carregada (não exige `canManage`).

## Fluxo de UI

1. Na ficha (`ColaboradorDetailDialog`), botão **Informar colaborador**.
2. Escolha do canal: **WhatsApp** ou **E-mail**.
3. Dialog de preview com:
   - texto gerado (textarea editável);
   - no canal e-mail: campo de **assunto** sugerido (também editável / copiável);
   - botão **Copiar** (corpo; no e-mail, opção clara de copiar assunto e/ou corpo).
4. Toast: “Mensagem copiada”.

Padrão visual: componentes já usados em férias (Dialog, Button, DropdownMenu ou similar para a escolha do canal).

## Conteúdo da mensagem

Nível: **resumo + períodos** (sem listar cada gozo individual).

### Dados incluídos

- Nome do colaborador
- Totais: adquiridos (`totalEntitledDays`), gozados (`totalTakenDays`), saldo (`pendingDays`)
- Por período aquisitivo em `balance.periods` (apenas períodos com direito / relevância prática — incluir todos os períodos retornados no balance, na ordem já usada na ficha):
  - intervalo (`period_start` – `period_end`)
  - direito (`entitled_days`)
  - usado (`usedDays`)
  - restante (`remainingDays`)
  - prazo concessivo (`concessive_end`), quando fizer sentido para o período
- Se `vacation_exempt`: mensagem curta informando que está fora do controle de férias (sem inventar saldo)

### Tom

- **WhatsApp**: curto, conversacional, saudação pelo primeiro nome.
- **E-mail**: saudação formal, mesmo bloco de dados, fechamento neutro (“Atenciosamente,” / sem inventar assinatura de pessoa).

### Assunto (e-mail)

Sugestão: `Saldo de férias — {Nome completo}`.

### Datas

Formato brasileiro (`dd/MM/yyyy`), alinhado ao restante do módulo de férias.

## Fora de escopo (v1)

- Abrir WhatsApp Web / cliente de e-mail automaticamente
- Enviar mensagem pelo sistema
- Incluir histórico detalhado de lançamentos (`leaves`)
- Templates persistentes / personalização por usuário
- Alterar regras de saldo ou permissões de acesso

## Técnico

### Biblioteca

Função pura em `src/lib/ferias/` (ex.: `message-template.ts`):

```ts
buildVacationBalanceMessage(
  detail: EmployeeDetail,
  channel: "whatsapp" | "email"
): { subject?: string; body: string }
```

- Sem I/O; só formatação a partir de `EmployeeDetail`.
- Testes unitários cobrindo WhatsApp, e-mail, colaborador isento e um caso com múltiplos períodos.

### UI

- Hook/ação no `colaborador-detail-dialog.tsx` (ou componente irmão no mesmo módulo).
- Clipboard: `navigator.clipboard.writeText` + feedback local (padrão já usado no app).
- Sem novas rotas ou APIs.

## Critérios de aceite

- [ ] Botão **Informar colaborador** visível na ficha para editor e viewer
- [ ] Fluxo: escolher canal → preview editável → copiar
- [ ] Texto inclui totais e períodos; WhatsApp e e-mail diferem no tom
- [ ] E-mail expõe assunto sugerido
- [ ] Isento gera mensagem adequada, sem números inventados
- [ ] Testes da função de template passam
