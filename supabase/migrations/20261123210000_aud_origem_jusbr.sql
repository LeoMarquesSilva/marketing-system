-- Pauta de Audiências: audiências fora da Minha Pauta, lidas no Jus.br (23/11/2026).
-- O robô da pauta procura no Jus.br (Portal de Serviços do CNJ) as audiências "só no VIOS": o processo não está na
-- Minha Pauta do certificado e a consulta do processo no PJe pede captcha. Elas entram com origem 'jusbr', e a leitura
-- fica registrada com fonte 'jusbr'. Quando o PJe passa a mostrar a mesma audiência, a do PJe vale.
alter table public.aud_audiencias drop constraint if exists aud_audiencias_origem_check;
alter table public.aud_audiencias add constraint aud_audiencias_origem_check check (origem in ('pje', 'vios', 'manual', 'jusbr'));

alter table public.aud_leituras drop constraint if exists aud_leituras_fonte_check;
alter table public.aud_leituras add constraint aud_leituras_fonte_check check (fonte in ('pje', 'djen', 'vios', 'jusbr'));
