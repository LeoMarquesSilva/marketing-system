-- Jus.br (consulta unificada do CNJ) como fonte oficial da capa e da linha do tempo, ao lado do DataJud.
-- O robô de autos lê a ficha do processo no Jus.br quando baixa os autos; a capa (sugestões gravadas direto no
-- cadastro) e os movimentos do tribunal passam a poder vir dela, com a origem registrada como 'jusbr'.

alter table public.proc_sugestoes drop constraint if exists proc_sugestoes_fonte_check;
alter table public.proc_sugestoes
  add constraint proc_sugestoes_fonte_check check (fonte in ('autos', 'datajud', 'cnj', 'jusbr'));

alter table public.proc_alteracoes drop constraint if exists proc_alteracoes_origem_check;
alter table public.proc_alteracoes
  add constraint proc_alteracoes_origem_check check (origem in ('manual', 'vios', 'ia', 'datajud', 'cnj', 'jusbr'));

alter table public.proc_andamentos drop constraint if exists proc_andamentos_fonte_check;
alter table public.proc_andamentos
  add constraint proc_andamentos_fonte_check check (fonte in ('datajud', 'jusbr', 'vios', 'manual', 'prazo', 'providencia'));

comment on column public.proc_andamentos.fonte is 'datajud ou jusbr (movimento do tribunal, pelo CNJ), vios, manual, prazo, providencia.';
