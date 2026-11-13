-- Fotos de eventos: foto fora do link de convidado (/galeria/<token>).
-- Ex.: retratos individuais dos colaboradores tirados no evento. A equipe continua vendo no álbum.
alter table public.event_photos
  add column if not exists guest_hidden boolean not null default false;

comment on column public.event_photos.guest_hidden is
  'Fora do link de convidado (/galeria/<token>), ex.: retratos individuais dos colaboradores. A equipe continua vendo no álbum.';
