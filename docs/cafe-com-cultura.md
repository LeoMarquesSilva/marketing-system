# Café com Cultura — check-in por NFC

## Fluxo

- URL permanente da etiqueta: `https://marketing-system-xi.vercel.app/cafe-com-cultura`.
- O colaborador precisa estar autenticado no ORQESTRAI; a presença é sempre vinculada à própria sessão.
- A edição padrão acontece na última sexta-feira do mês, com check-in das 09h às 12h no fuso `America/Sao_Paulo`.
- O cron mantém a edição atual e a próxima criadas e sincroniza as justificativas do RESPONSUM.
- Data, local, prazo operacional e janela de check-in podem ser alterados na aba **Presenças** do evento.

## RESPONSUM

A sincronização considera somente chamados da categoria:

- Frente: `Pessoas e Cultura`;
- Categoria: `Café com cultura` (`cafe_com_cultura`);
- Subcategoria: `Justificativa de Ausência` (`justificativa_de_ausencia`).

A data da edição deve aparecer no título ou na descrição do chamado no formato `DD/MM` ou `DD/MM/AAAA`. O painel administrativo também permite executar **Sincronizar agora**.

As credenciais dedicadas abaixo têm prioridade e devem ser cadastradas apenas como segredos server-side:

```dotenv
RESPONSUM_SUPABASE_URL=
RESPONSUM_SUPABASE_SERVICE_KEY=
```

Quando elas não estão disponíveis, o backend resolve temporariamente a chave `service_role` do projeto RESPONSUM usando `SUPABASE_MANAGEMENT_ACCESS_TOKEN`, que já é utilizado pelo ORQESTRAI. Nenhuma dessas variáveis pode usar o prefixo `NEXT_PUBLIC_`.

## Administração

Na aba **Presenças** do evento Café com Cultura, administradores podem:

- consultar confirmados, ausências justificadas e check-ins;
- buscar colaboradores com nome, foto, área e e-mail;
- corrigir a expectativa e registrar/remover presença manualmente;
- atualizar o roster de colaboradores ativos;
- sincronizar justificativas do RESPONSUM;
- exportar CSV com BOM UTF-8 e separador `;`.

O modelo NFC de sistema **Café com Cultura — Check-in mensal** já aponta para a URL permanente e exige autenticação.

## Operação mensal

1. Confira a edição criada automaticamente em **Eventos**.
2. Ajuste data/local e informe manualmente o prazo de fechamento, quando necessário.
3. Use **Sincronizar agora** antes de enviar a quantidade final ao local.
4. No dia, mantenha o mesmo cartão NFC na entrada; não é necessário regravar a etiqueta.
5. Ao final, exporte o CSV ou consulte os totais na própria aba.
