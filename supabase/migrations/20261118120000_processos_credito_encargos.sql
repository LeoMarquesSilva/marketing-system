-- Processos: percentuais de honorários e de multa no cálculo do valor atualizado (Rec. Crédito).
--
-- Vazio = o padrão pela ação: cumprimento de sentença com o devedor intimado que não pagou (CPC art. 523, §1º:
-- multa de 10% e honorários de 10%); execução de título extrajudicial (CPC art. 827: honorários de 10%). A
-- equipe preenche quando o caso é outro (pagou no prazo, honorários fixados em outro percentual).

alter table public.proc_credito add column if not exists honorarios_percentual numeric(6, 2) check (honorarios_percentual is null or (honorarios_percentual >= 0 and honorarios_percentual <= 100));
alter table public.proc_credito add column if not exists multa_percentual numeric(6, 2) check (multa_percentual is null or (multa_percentual >= 0 and multa_percentual <= 100));

comment on column public.proc_credito.honorarios_percentual is 'Honorários da execução ou do cumprimento de sentença, em %. Vazio = padrão pela ação (10% em execução de título extrajudicial e em cumprimento de sentença).';
comment on column public.proc_credito.multa_percentual is 'Multa do art. 523, §1º do CPC, em %. Vazio = padrão pela ação (10% em cumprimento de sentença, zero nos demais).';
