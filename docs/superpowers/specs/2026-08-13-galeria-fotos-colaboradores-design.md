# Galeria de fotos corporativas do colaborador

## Objetivo

Depois da sessão de fotos no escritório, o marketing sobe as fotos de cada pessoa no sistema. O colaborador, ao entrar, vê o módulo **Minhas fotos**, escolhe os usos de cada imagem e a marcada como **Oficial** vira avatar do sistema e foto do perfil NFC na hora.

## Decisões

| Tema | Decisão |
|------|---------|
| Origem | Pastas no Drive por colaborador; upload **manual pessoa a pessoa** (sem import Drive) |
| Quem sobe | Só o MTK (acesso a Fotos Colaboradores) |
| Quem escolhe | O colaborador, só nas fotos dele |
| Usos | Oficial (fixo) + categorias de peça; a mesma foto pode ter vários usos; cada uso tem no máximo uma foto |
| Categorias iniciais | Posts, Site/materiais, Eventos |
| Categorias extras | MTK/admin cria, renomeia, desativa e reordena; Oficial não apaga nem desativa |
| LinkedIn | Fora do escopo (cada um atualiza o próprio) |
| Onde o colaborador vê | Módulo próprio no menu: `/minhas-fotos` |
| Checklist Copa | Permanece em `/fotos-colaboradores`; a galeria entra por pessoa |

## Banco (ORQESTRAI)

### `collaborator_photos`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid → `users(id)` ON DELETE CASCADE | Dono da foto |
| `storage_path` | text | Path no bucket `MARKETING-SYSTEM-FOTOS` |
| `public_url` | text | URL pública |
| `original_filename` | text nullable | |
| `uploaded_by` | uuid → `users(id)` ON DELETE SET NULL | Quem do MTK subiu |
| `created_at` | timestamptz | default now() |

### `photo_usage_types`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `slug` | text unique | `oficial`, `posts`, `site-materiais`, `eventos` |
| `label` | text | Nome na UI |
| `is_official` | boolean | Exatamente um registro true |
| `is_system` | boolean | Oficial: não apaga |
| `sort_order` | int | |
| `is_active` | boolean | Categorias extras podem desativar |
| `created_at` | timestamptz | |

Seed: Oficial (system), Posts, Site/materiais, Eventos.

### `collaborator_photo_usages`

PK `(user_id, usage_type_id)`. Uma foto por uso por pessoa. `photo_id` → `collaborator_photos` ON DELETE CASCADE.

Quando Oficial é atribuída: gravar `users.avatar_url` e `professional_profiles.photo_url` (se existir perfil). Ao apagar a foto oficial, limpar avatar/NFC **somente se** apontavam para a URL da foto apagada. Não escolher outra automaticamente.

## Permissões

- `/minhas-fotos` sempre liberada para autenticado (como `/perfil`). Não entra no catálogo de permissões.
- Colaborador de conteúdo também vê o item no menu.
- Upload/exclusão de arquivos e edição de categorias: quem já acessa `/fotos-colaboradores`.
- Colaborador A não lê foto do B.

## Telas

1. **Minhas fotos** — grade, chips de uso, empty state se o MTK ainda não subiu nada.
2. **Fotos Colaboradores** — botão/galeria por pessoa: upload múltiplo, exclusão, ver escolhas e pendência de oficial.
3. **Usos** — painel na área de fotos (visível para quem gerencia).

## Limites

- Imagens: jpeg, png, webp, gif. Máximo 15 MB.
- Upload falho não cria linha na galeria.

## Fora de escopo

- Integração Google Drive
- Bulk por pasta
- LinkedIn
- Upload pelo colaborador
