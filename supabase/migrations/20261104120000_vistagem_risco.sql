-- Vistagem: quem do jurídico vista demanda de risco (Usuários › acesso).
-- Sim (padrão): vê todas as publicações das suas áreas. Não: só as sem risco; as de risco ficam para
-- quem as vista (ex.: a Isadora vista só as normais, e as de risco vão para o responsável).
-- A controladoria vê todas.
alter table public.users
  add column if not exists vistagem_risco boolean not null default true;
comment on column public.users.vistagem_risco is
  'Vistagem (jurídico): se a pessoa vista publicações de demanda de risco. false = só as sem risco. A controladoria vê todas.';
