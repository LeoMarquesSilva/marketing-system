# Perfis NFC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o módulo “Perfis NFC” no ORQESTRAI, com importação reconciliada de colaboradores, administração editorial, páginas públicas bilíngues, cartões NFC/QR, vCard, conteúdo recente, campanha e métricas com privacidade.

**Architecture:** Manter `users` como identidade canônica e criar um domínio de perfis profissionais 1:1, isolado em `src/lib/profiles`. Toda leitura pública passa por uma projeção server-side que só devolve perfil publicado e campos habilitados. O NFC Hub administra perfis e cartões, enquanto `/perfil/[slug]` renderiza a experiência pública e `/t/[token]` continua sendo a entrada rastreável dos cartões.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres com RLS, Zod, Vitest, Tailwind CSS 4, `xlsx`, `qrcode`, Vercel.

## Global Constraints

- Preservar alterações não relacionadas e nunca stagear `.codex-tmp/` nem `.claude/worktrees/eager-clarke-f9274b`.
- Gerar a migração exclusivamente com o Supabase CLI; não inventar timestamp de arquivo.
- Todos os perfis importados começam como `draft`; nenhuma importação publica ou desativa usuários.
- Nunca copiar data de nascimento do XLSM para o domínio de perfis.
- Telefone/WhatsApp e e-mail ficam privados até ativação explícita do administrador.
- A área administrativa de perfis exige papel `admin`; possuir apenas a permissão `/nfc` não basta para importar, editar ou publicar.
- A página pública não usa sessão, mas deve emitir `noindex, nofollow`.
- Ausência de conteúdo, falha no registro de métricas ou tradução EN incompleta não pode impedir a abertura do perfil.
- Inglês incompleto usa fallback por campo para `pt-BR`.
- Não persistir IP, localização exata, telefone do visitante, texto de mensagens ou outros identificadores pessoais do visitante.
- Reusar `public/LOGO HORIZONTAL AZUL.png` e os componentes existentes antes de criar novos primitivos.
- Não adicionar dependências sem demonstrar que `xlsx`, `qrcode`, Zod, Tailwind e os componentes atuais são insuficientes.
- Para testes de componentes, usar o padrão já disponível no repositório (`react-dom/server` para marcação e funções/reducers puros para interação); reservar comportamento real, viewport e acessibilidade para a verificação de navegador, sem introduzir uma biblioteca de testes por conveniência.
- Implementar cada tarefa em ciclo red-green-refactor e executar os testes focados antes do commit.
- Antes de publicar, confirmar que o push para `main` será fast-forward, atualizar referências e verificar o SHA remoto.

---

## Task 1: Create the professional-profile database domain

**Files:**

- Create: exact CLI-generated file under `supabase/migrations/` ending in `_professional_profiles.sql`
- Test/inspect: `supabase/migrations/20260720120000_nfc_hub.sql`
- Test/inspect: `supabase/migrations/20260724184734_nfc_forms_cafe_cultura_asset_loans.sql`

- [x] **Step 1: Generate the migration filename with the official CLI**

Run:

```powershell
npx.cmd --yes supabase@latest migration new professional_profiles
```

Expected: the CLI prints one new path under `supabase/migrations/`. Use that exact path in all remaining steps.

- [x] **Step 2: Define enums/check constraints and the core profile tables**

Create these tables with UUID primary keys, UTC timestamps, `created_by`/`updated_by` where applicable, foreign keys and explicit check constraints:

```sql
create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete restrict,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  photo_url text,
  oab text,
  joined_on date,
  professional_email text,
  professional_phone text,
  linkedin_url text,
  website_url text,
  show_tenure boolean not null default true,
  show_email boolean not null default false,
  show_whatsapp boolean not null default false,
  show_linkedin boolean not null default true,
  show_website boolean not null default true,
  published_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_profile_localizations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  locale text not null check (locale in ('pt-BR', 'en')),
  is_approved boolean not null default false,
  display_name text,
  role text,
  practice_area text,
  tagline text,
  bio text,
  unique (profile_id, locale)
);
```

- [x] **Step 3: Define ordered sections, localized entries and content overrides**

Use:

```sql
create table public.professional_profile_sections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  section_key text not null check (
    section_key in ('practice', 'education', 'knowledge', 'highlights', 'timeline')
  ),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  unique (profile_id, section_key)
);

create table public.professional_profile_entries (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.professional_profile_sections(id) on delete cascade,
  entry_type text not null,
  link_url text,
  image_url text,
  occurred_on date,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_visible boolean not null default true
);

create table public.professional_profile_entry_localizations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.professional_profile_entries(id) on delete cascade,
  locale text not null check (locale in ('pt-BR', 'en')),
  title text not null,
  subtitle text,
  description text,
  unique (entry_id, locale)
);

create table public.professional_profile_content_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  source_type text not null check (source_type in ('instagram', 'linkedin', 'reel_studio')),
  source_id text not null,
  is_hidden boolean not null default true,
  unique (profile_id, source_type, source_id)
);
```

- [x] **Step 4: Define card history, redirects, campaign and privacy-safe events**

Use:

```sql
create table public.professional_profile_cards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  nfc_tag_id uuid unique references public.nfc_tags(id) on delete set null,
  code text not null unique,
  label text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'replaced', 'inactive')),
  replaced_card_id uuid references public.professional_profile_cards(id) on delete set null,
  issued_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.professional_profile_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  old_slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.professional_profile_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.professional_profiles(id) on delete cascade,
  card_id uuid references public.professional_profile_cards(id) on delete set null,
  event_type text not null check (event_type in (
    'profile_view', 'nfc_scan', 'qr_scan', 'contact_download', 'share',
    'whatsapp_click', 'email_click', 'linkedin_click', 'website_click'
  )),
  source text not null default 'direct'
    check (source in ('direct', 'nfc', 'qr', 'share')),
  locale text not null default 'pt-BR' check (locale in ('pt-BR', 'en')),
  occurred_at timestamptz not null default now()
);

create table public.professional_profile_campaign (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  title_pt text not null default 'Dia da Advocacia 2026',
  title_en text not null default 'Lawyers’ Day 2026',
  message_pt text not null default 'A advocacia começa pela escuta.',
  message_en text not null default 'Advocacy begins with listening.',
  call_to_action_pt text,
  call_to_action_en text,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
```

Add indexes for status/slug, profile entry ordering, card status, event profile/time/type, and content source lookup. Add an `updated_at` trigger using the repository’s existing trigger convention.

Add `public.record_professional_profile_event(...)` as the only event-write function. It validates the closed event/source/locale lists and enforces a coarse per-profile/event minute cap of 300 accepted events without storing IP, user-agent, referrer or visitor identifiers.

- [x] **Step 5: Add an atomic import function**

Create `public.apply_professional_profile_import(p_rows jsonb, p_actor_id uuid)` that:

1. rejects calls without a service/admin context;
2. locks matching users by normalized corporate email;
3. upserts one draft profile per matched user;
4. inserts `pt-BR` localization and default section rows;
5. updates only empty/default profile fields on re-import unless `overwrite=true` is explicitly present in the validated row;
6. never changes `users.is_active`, roles or permissions;
7. never accepts or stores a birth-date property;
8. returns counts for `created`, `updated`, `skipped`, `unmatched`.

- [x] **Step 6: Enable RLS and deny direct anonymous reads**

Enable RLS on every new table. Add authenticated admin policies following the repository’s role lookup pattern, but do not create public/anon SELECT policies. Public profile reads will use the server-only Supabase admin client and a field-limited projection. Every `security definer` function must set an explicit safe `search_path`, revoke public execution and grant only the server role required by the application.

- [x] **Step 7: Validate the migration locally or through the connected project**

Run the available local validation:

```powershell
npx.cmd --yes supabase@latest db lint --local
```

If no local stack exists, inspect/apply with the connected Supabase tooling, then run database advisors. Verify anon cannot select/insert, a non-admin authenticated user cannot mutate, and the server/admin path can perform the intended operations. Expected: no destructive-change warning, no missing RLS warning, unsafe-function warning or unindexed foreign-key warning for the new tables.

- [x] **Step 8: Commit the database domain**

```powershell
$migration = Get-ChildItem supabase/migrations/*_professional_profiles.sql |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
git add -- $migration.FullName
git commit -m "feat: add professional profile schema"
```

---

## Task 2: Define domain contracts and pure helpers

**Files:**

- Create: `src/lib/profiles/types.ts`
- Create: `src/lib/profiles/validation.ts`
- Create: `src/lib/profiles/validation.test.ts`
- Create: `src/lib/profiles/slug.ts`
- Create: `src/lib/profiles/slug.test.ts`
- Create: `src/lib/profiles/localization.ts`
- Create: `src/lib/profiles/localization.test.ts`
- Create: `src/lib/profiles/campaign.ts`
- Create: `src/lib/profiles/campaign.test.ts`

- [x] **Step 1: Write failing tests for validation, slugging, locale fallback and campaign precedence**

Cover:

```ts
expect(makeProfileSlug("Letícia Rodrigues")).toBe("leticia-rodrigues");
expect(resolveProfileLocale("en-US")).toBe("en");
expect(resolveProfileLocale("pt")).toBe("pt-BR");
expect(localizeField({ en: "", "pt-BR": "Sócia" }, "en")).toBe("Sócia");
expect(selectApprovedLocalization(pt, { ...en, isApproved: false }, "en")).toBe(pt);
expect(isProfileCampaignActive({ enabled: false, startsAt, endsAt }, now)).toBe(false);
```

Also assert that an import row containing `birthDate` or `dataNascimento` is stripped/rejected by the public import schema and that malformed external URLs fail validation.

Run:

```powershell
npm.cmd test -- src/lib/profiles/validation.test.ts src/lib/profiles/slug.test.ts src/lib/profiles/localization.test.ts src/lib/profiles/campaign.test.ts
```

Expected: FAIL because modules do not exist.

- [x] **Step 2: Define shared types**

At minimum:

```ts
export type ProfileLocale = "pt-BR" | "en";
export type ProfessionalProfileStatus = "draft" | "published" | "archived";
export type ProfileSectionKey =
  | "practice" | "education" | "knowledge" | "highlights" | "timeline";
export type ProfileCardStatus = "pending" | "active" | "replaced" | "inactive";
export type ProfileEventType =
  | "profile_view" | "nfc_scan" | "qr_scan" | "contact_download" | "share"
  | "whatsapp_click" | "email_click" | "linkedin_click" | "website_click";
export type ProfileEventSource = "direct" | "nfc" | "qr" | "share";

export interface PublicProfessionalProfile {
  id: string;
  slug: string;
  locale: ProfileLocale;
  identity: {
    name: string;
    role: string;
    practiceArea: string;
    oab: string | null;
    photoUrl: string | null;
    tagline: string;
    bio: string;
    joinedOn: string | null;
    tenureLabel: string | null;
  };
  contacts: {
    email: string | null;
    whatsapp: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
  };
  sections: PublicProfileSection[];
  recentContent: ProfileContentItem[];
  campaignMessage: string | null;
}
```

Add admin detail/list/import/analytics contracts without exposing private contacts through the public type.

- [x] **Step 3: Implement Zod schemas and pure helpers**

Implement:

```ts
makeProfileSlug(name: string): string
resolveProfileLocale(requested?: string | null): ProfileLocale
localizeField(values: Partial<Record<ProfileLocale, string | null>>, locale: ProfileLocale): string
selectApprovedLocalization(pt, en, locale): ProfessionalProfileLocalization
isProfileCampaignActive(campaign: ProfileCampaign, now: Date): boolean
```

Campaign rule: `enabled=false` always wins; when enabled, missing boundaries are open-ended; otherwise `startsAt <= now <= endsAt`.

Localization rule: an unapproved English record falls back completely to PT; an approved English record may still fall back field-by-field for optional blank values.

- [x] **Step 4: Run focused tests**

```powershell
npm.cmd test -- src/lib/profiles/validation.test.ts src/lib/profiles/slug.test.ts src/lib/profiles/localization.test.ts src/lib/profiles/campaign.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit contracts and helpers**

```powershell
git add src/lib/profiles
git commit -m "feat: add professional profile contracts"
```

---

## Task 3: Build strict admin authorization and the profile repository

**Files:**

- Create: `src/lib/profiles/auth.ts`
- Create: `src/lib/profiles/admin.ts`
- Create: `src/lib/profiles/admin.test.ts`
- Modify only if a reusable helper is missing: `src/lib/supabase-server.ts`

- [x] **Step 1: Write failing repository tests**

Mock the Supabase boundary and verify:

- `requireProfessionalProfileAdmin()` accepts only role `admin`;
- `/nfc` permission without `admin` is rejected with 403;
- list filters by status, search and completeness;
- save preserves unrelated localized fields;
- changing slug inserts the previous slug into redirects;
- publish rejects missing name, role, tagline or photo;
- unpublish changes status to `draft` without deleting history.

Run:

```powershell
npm.cmd test -- src/lib/profiles/admin.test.ts
```

Expected: FAIL.

- [x] **Step 2: Implement the strict authorization boundary**

Expose:

```ts
export async function requireProfessionalProfileAdmin(): Promise<{
  userId: string;
  role: "admin";
}>;
```

Reuse the current authenticated-user lookup, but do not call `requireNfcManager()` because that also accepts a section permission.

- [x] **Step 3: Implement admin repository operations**

Expose:

```ts
listProfessionalProfiles(filters): Promise<ProfessionalProfileListResult>
getProfessionalProfileAdmin(id: string): Promise<ProfessionalProfileAdminDetail>
saveProfessionalProfile(id: string, input, actorId: string): Promise<ProfessionalProfileAdminDetail>
setProfessionalProfileStatus(id: string, status, actorId: string): Promise<void>
setContentOverride(profileId: string, sourceType, sourceId, hidden: boolean): Promise<void>
getProfessionalProfileAnalytics(profileId: string, range): Promise<ProfessionalProfileAnalytics>
```

Use explicit selects. Do not use `select("*")` in the public projection implemented in Task 9.

- [x] **Step 4: Run focused tests and typecheck through the build**

```powershell
npm.cmd test -- src/lib/profiles/admin.test.ts
npx.cmd tsc --noEmit
```

Expected: PASS.

- [x] **Step 5: Commit the admin repository**

```powershell
git add src/lib/profiles
git commit -m "feat: add professional profile repository"
```

---

## Task 4: Add tested admin APIs

**Files:**

- Create: `src/app/api/nfc/profiles/route.ts`
- Create: `src/app/api/nfc/profiles/[id]/route.ts`
- Create: `src/app/api/nfc/profiles/[id]/status/route.ts`
- Create: `src/app/api/nfc/profiles/[id]/content-overrides/route.ts`
- Create: `src/app/api/nfc/profiles/[id]/analytics/route.ts`
- Create: `src/app/api/nfc/profiles/campaign/route.ts`
- Create: `src/app/api/nfc/profiles/profile-api.test.ts`

- [x] **Step 1: Write failing route tests**

Test 401 unauthenticated, 403 non-admin, 400 invalid payload, 404 missing profile and successful list/read/update/status/override/campaign responses.

The status payload is:

```ts
{ status: "draft" | "published" | "archived" }
```

The update payload includes base fields, two localizations, section visibility/order and entry CRUD in one transaction-shaped request.

- [x] **Step 2: Implement thin route handlers**

Each handler must:

1. call `requireProfessionalProfileAdmin`;
2. parse params/body with Zod;
3. call one repository operation;
4. map known errors to stable error codes;
5. avoid logging private contact values.

Use stable codes such as `PROFILE_FORBIDDEN`, `PROFILE_INVALID`, `PROFILE_NOT_FOUND`, `PROFILE_SAVE_FAILED`.

- [x] **Step 3: Run route and repository tests**

```powershell
npm.cmd test -- src/app/api/nfc/profiles/profile-api.test.ts src/lib/profiles/admin.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit the admin API**

```powershell
git add src/app/api/nfc/profiles
git commit -m "feat: add professional profile admin api"
```

---

## Task 5: Implement safe XLSM preview and transactional import

**Files:**

- Create: `src/lib/profiles/import.ts`
- Create: `src/lib/profiles/import.test.ts`
- Create: `src/app/api/nfc/profiles/import/preview/route.ts`
- Create: `src/app/api/nfc/profiles/import/apply/route.ts`
- Create: `src/app/api/nfc/profiles/import/import-api.test.ts`

- [x] **Step 1: Add a minimal workbook fixture in the test**

Generate the in-memory fixture with the existing `xlsx` package. Include:

- one active matched collaborator;
- one inactive spreadsheet row;
- one unmatched email;
- accents in name/role/area;
- date of birth, which must never appear in parsed output;
- hire date, which can become a timeline proposal but not be persisted until selected.

- [x] **Step 2: Write failing parser and reconciliation tests**

Expose and test:

```ts
parseCollaboratorWorkbook(buffer: ArrayBuffer): ProfessionalProfileImportRow[]
buildImportPreview(
  rows: ProfessionalProfileImportRow[],
  users: ImportUserCandidate[],
  profiles: ImportExistingProfile[]
): ProfessionalProfileImportPreview
```

Matching uses lowercase trimmed corporate email. The preview returns `create`, `update`, `unchanged`, `unmatched` and `inactiveSource` rows, with field-level differences. It never proposes changing user activity, roles or permissions.

Also verify idempotency (applying the same accepted rows twice creates no duplicates), duplicate corporate e-mails are blocked per row, and slug collisions receive a deterministic numeric suffix rather than overwriting another profile.

Run:

```powershell
npm.cmd test -- src/lib/profiles/import.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement parser and preview**

Parse the known sheet shape without relying on workbook macros. Normalize strings as UTF-8 JavaScript strings. Map only:

- name;
- corporate email;
- role;
- area;
- professional phone as a private candidate;
- hire date as the optional `joined_on`/tenure candidate;
- active/inactive as preview information only.

Do not return birth date from the parser.

- [x] **Step 4: Implement preview and apply endpoints**

Both receive `multipart/form-data` with an `.xlsm`/`.xlsx` file. Apply additionally receives selected normalized emails and `overwrite=false` by default. Apply reparses and reconciles the file server-side before calling `apply_professional_profile_import`; it must not trust preview JSON sent by the browser.

Set a reasonable upload limit and reject other file types.

- [x] **Step 5: Run parser and API tests**

```powershell
npm.cmd test -- src/lib/profiles/import.test.ts src/app/api/nfc/profiles/import/import-api.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit the import flow**

```powershell
git add src/lib/profiles/import.ts src/lib/profiles/import.test.ts src/app/api/nfc/profiles/import
git commit -m "feat: add profile import preview"
```

---

## Task 6: Build the profile administration dashboard

**Files:**

- Modify: `src/components/nfc/nfc-subnav.tsx`
- Create: `src/app/nfc/perfis/page.tsx`
- Create: `src/components/nfc/profiles/profiles-dashboard-client.tsx`
- Create: `src/components/nfc/profiles/profile-import-dialog.tsx`
- Create: `src/components/nfc/profiles/profile-status-badge.tsx`
- Create: `src/components/nfc/profiles/profiles-dashboard-client.test.tsx`

- [x] **Step 1: Write failing component tests**

Cover:

- “Perfis” appears in NFC subnavigation;
- filters for draft/published/archived;
- cards show photo, name, role, completeness, status and views;
- the import dialog shows preview groups and defaults to safe selections;
- mobile list preserves all actions without horizontal overflow.

- [x] **Step 2: Add the Perfis tab and server page**

The server page authorizes with `requireProfessionalProfileAdmin`, loads initial list/summary and renders the client. The dashboard summary includes total, draft, published, incomplete, scans in period and card counts by pending/active/replaced/inactive status.

- [x] **Step 3: Implement the responsive dashboard**

Desktop uses a compact table; mobile uses stacked cards. Add search, status filter, completeness filter, import button and “Editar” action. Do not expose private phone/e-mail in the list.

- [x] **Step 4: Implement the two-step import dialog**

Flow:

1. upload;
2. preview counts and differences;
3. row selection;
4. explicit apply confirmation;
5. result counts and refresh.

Inactive spreadsheet rows are unselected by default. No row is auto-published.

- [x] **Step 5: Run UI tests, lint and typecheck**

```powershell
npm.cmd test -- src/components/nfc/profiles/profiles-dashboard-client.test.tsx
npm.cmd run lint -- src/app/nfc/perfis src/components/nfc/nfc-subnav.tsx src/components/nfc/profiles
npx.cmd tsc --noEmit
```

Expected: PASS.

- [x] **Step 6: Commit the dashboard**

```powershell
git add src/components/nfc/nfc-subnav.tsx src/app/nfc/perfis src/components/nfc/profiles
git commit -m "feat: add profile admin dashboard"
```

---

## Task 7: Build the bilingual profile editor

**Files:**

- Create: `src/app/nfc/perfis/[id]/page.tsx`
- Create: `src/components/nfc/profiles/profile-editor-client.tsx`
- Create: `src/components/nfc/profiles/profile-identity-form.tsx`
- Create: `src/components/nfc/profiles/profile-contact-form.tsx`
- Create: `src/components/nfc/profiles/profile-localization-tabs.tsx`
- Create: `src/components/nfc/profiles/profile-sections-editor.tsx`
- Create: `src/components/nfc/profiles/profile-publication-panel.tsx`
- Create: `src/components/nfc/profiles/profile-editor-client.test.tsx`

- [x] **Step 1: Write failing editor tests**

Verify:

- PT/EN tabs retain independent edits;
- empty EN values visibly declare PT fallback;
- phone/e-mail toggles default off;
- English content is used publicly only after its localization is marked approved;
- section and entry visibility can be changed;
- entry ordering persists in payload;
- publish button is disabled with a clear checklist when required fields are absent;
- slug edits show the final public URL;
- mobile layout keeps save/publish controls reachable.

- [x] **Step 2: Implement editor data flow**

Load full admin detail on the server. Keep a single form state with dirty tracking. Save explicit arrays for localizations, sections and entries. Warn before navigation with unsaved changes.

- [x] **Step 3: Implement identity and contact sections**

Identity: photo URL/current user avatar, display name, role, practice area, OAB, tagline, bio, slug.

Contacts: professional e-mail, phone/WhatsApp, LinkedIn, site and independent visibility switches. Never infer phone visibility from presence.

- [x] **Step 4: Implement ordered content sections**

Allow add/edit/hide/reorder for:

- areas of practice;
- education, qualifications and languages;
- knowledge/manual content;
- professional highlights;
- Bismarchi | Pires timeline.

Keep `###`-level details inside the same visual item; avoid a generic JSON editor.

- [x] **Step 5: Implement publication checklist and preview link**

Required for publish: photo, PT name, role, practice area, tagline, bio, institutional e-mail, at least one enabled contact action and unique slug. OAB remains optional. Preview in draft is admin-authenticated; the public route remains unavailable until published.

- [x] **Step 6: Run focused tests and quality gates**

```powershell
npm.cmd test -- src/components/nfc/profiles/profile-editor-client.test.tsx
npm.cmd run lint -- src/app/nfc/perfis src/components/nfc/profiles
npx.cmd tsc --noEmit
```

Expected: PASS.

- [x] **Step 7: Commit the editor**

```powershell
git add src/app/nfc/perfis/[id] src/components/nfc/profiles
git commit -m "feat: add bilingual profile editor"
```

---

## Task 8: Aggregate recent content without duplicating source records

**Files:**

- Create: `src/lib/profiles/content.ts`
- Create: `src/lib/profiles/content.test.ts`
- Create: `src/components/nfc/profiles/profile-content-panel.tsx`
- Modify: `src/components/nfc/profiles/profile-editor-client.tsx`

- [x] **Step 1: Write failing adapter tests**

Test source adapters for:

- `instagram_posts` linked by `solicitante_id` or the existing `solicitantes` relation;
- `linkedin_posts` linked through its existing Instagram relation/byline mapping;
- `reel_studio_items` linked through `reel_studio_assignees.user_id`;
- stable source keys `${sourceType}:${sourceId}`;
- newest-first ordering;
- hidden override removal;
- deduplication when LinkedIn and Instagram refer to the same underlying publication;
- maximum three visible items;
- source query failure returns remaining sources instead of throwing.

Do not interpret `content_roteiros.approved_by_id` as authorship and do not infer event participation without a direct relation.

- [x] **Step 2: Implement the content aggregator**

Expose:

```ts
listRecentProfessionalContent(
  supabase: SupabaseClient,
  input: {
    userId: string;
    userName: string;
    hiddenKeys: Set<string>;
    limit: number;
  }
): Promise<ProfileContentItem[]>
```

Normalize each source to id, type, title, image, URL and published date. Use `Promise.allSettled` so one source cannot blank the page.

- [x] **Step 3: Run focused tests**

Before testing, add the editor panel that previews the automatically associated items, labels their source/date and lets an admin hide or restore one item through the content-override API. The action changes only the override table, never the original publication.

```powershell
npm.cmd test -- src/lib/profiles/content.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit content aggregation**

```powershell
git add src/lib/profiles/content.ts src/lib/profiles/content.test.ts src/components/nfc/profiles
git commit -m "feat: aggregate recent profile content"
```

---

## Task 9: Create the public projection, metadata and vCard

**Files:**

- Create: `src/lib/profiles/public.ts`
- Create: `src/lib/profiles/public.test.ts`
- Create: `src/lib/profiles/vcard.ts`
- Create: `src/lib/profiles/vcard.test.ts`
- Create: `src/app/perfil/[slug]/page.tsx`
- Create: `src/app/perfil/[slug]/contato/route.ts`
- Create: `src/app/perfil/not-found.tsx`

- [x] **Step 1: Write failing public projection tests**

Verify:

- only `published` profiles resolve;
- archived/draft return null;
- current slug and old redirect slug are distinguished;
- hidden email/phone are returned as null;
- unapproved EN falls back completely to PT and approved EN falls back per optional field;
- hidden entries are omitted and ordering is stable;
- recent-content failure still returns the profile;
- campaign failure returns `campaignMessage=null`.

- [x] **Step 2: Write failing vCard tests**

Cover CRLF output, UTF-8 characters, escaping commas/semicolons/newlines, organization, role, visible email/phone only, LinkedIn/site URLs and deterministic filename.

Expose:

```ts
buildVCard(contact: VCardContact): string
makeVCardFilename(displayName: string): string
```

- [x] **Step 3: Implement the explicit public projection**

Expose:

```ts
getPublicProfessionalProfile(
  slug: string,
  locale: ProfileLocale
): Promise<
  | { kind: "profile"; profile: PublicProfessionalProfile }
  | { kind: "redirect"; slug: string }
  | null
>
```

Use the server-only admin client with explicit column lists. Do not return admin flags, private values, audit columns or unpublished localizations.

- [x] **Step 4: Implement the route and robots metadata**

`/perfil/[slug]?lang=en` renders the profile; unsupported locale falls back to PT. Old slugs issue a permanent redirect to the current slug. Add `src/app/perfil/not-found.tsx` with a friendly institutional not-found/inactive state. `generateMetadata` includes:

```ts
robots: { index: false, follow: false, googleBot: { index: false, follow: false } }
```

Also include Open Graph name, role, description and professional photo while retaining `noindex`. Draft/archived/not found uses `notFound()` and therefore renders the friendly institutional state rather than a generic framework page.

- [x] **Step 5: Implement the vCard route**

The route reuses the public projection and records `contact_download` on a best-effort basis. Return:

```http
Content-Type: text/vcard; charset=utf-8
Content-Disposition: attachment; filename="<safe-name>.vcf"
Cache-Control: private, no-store
```

- [x] **Step 6: Run focused tests**

```powershell
npm.cmd test -- src/lib/profiles/public.test.ts src/lib/profiles/vcard.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit the public domain**

```powershell
git add src/lib/profiles/public.ts src/lib/profiles/public.test.ts src/lib/profiles/vcard.ts src/lib/profiles/vcard.test.ts src/app/perfil
git commit -m "feat: add public professional profile projection"
```

---

## Task 10: Build the editorial public profile experience

**Files:**

- Create: `src/components/profiles/professional-profile-page.tsx`
- Create: `src/components/profiles/profile-hero.tsx`
- Create: `src/components/profiles/profile-contact-actions.tsx`
- Create: `src/components/profiles/profile-section-list.tsx`
- Create: `src/components/profiles/profile-recent-content.tsx`
- Create: `src/components/profiles/profile-institutional-footer.tsx`
- Create: `src/components/profiles/professional-profile-page.test.tsx`
- Create: `src/components/profiles/profile-public-utils.ts`
- Create: `src/components/profiles/professional-profile-page.module.css`
- Modify: `src/app/perfil/[slug]/page.tsx`

- [x] **Step 1: Write failing public UI tests**

Cover:

- hero with professional photo, logo, name, role, area, optional OAB and tagline;
- “Salvar contato” always present;
- e-mail/WhatsApp buttons absent when private;
- campaign strip only when active;
- enabled sections render in configured order;
- three recent contents at most;
- missing photo falls back to an institutional initials avatar;
- PT/EN switch preserves slug and source;
- share fallback copies canonical URL;
- vCard failure offers copying the currently visible contact fields;
- mobile at 320 px has no horizontal overflow and 44 px touch targets.

- [x] **Step 2: Implement the visual direction**

Use an editorial/legal/contemporary composition:

- off-white paper-like background;
- deep navy typography/structure;
- restrained gold accents;
- generous spacing and readable measure;
- minimal motion that honors reduced-motion;
- no link-in-bio stack, glassmorphism or generic gradient cards.

Use `public/LOGO HORIZONTAL AZUL.png` with appropriate alt text.

- [x] **Step 3: Implement contact/share actions**

Order:

1. Salvar contato;
2. WhatsApp, when visible;
3. e-mail, when visible;
4. LinkedIn, when visible;
5. compartilhar;
6. site do escritório.

Use `navigator.share` when available, then clipboard fallback. Preserve `source` in the shared URL only when it is one of the allowed sources.

- [x] **Step 4: Implement section, content and footer layouts**

Render sections semantically with headings, dates and accessible links. The footer includes firm logo, address/site/social links already configured in the system and an institutional-profile notice. Do not hardcode private contact data.

- [x] **Step 5: Run UI checks**

```powershell
npm.cmd test -- src/components/profiles/professional-profile-page.test.tsx
npm.cmd run lint -- src/app/perfil src/components/profiles
npx.cmd tsc --noEmit
```

Expected: PASS.

- [x] **Step 6: Commit the public experience**

```powershell
git add src/app/perfil src/components/profiles
git commit -m "feat: add editorial public profiles"
```

---

## Task 11: Integrate professional profiles with NFC cards and QR

**Files:**

- Modify: `src/lib/nfc/types.ts`
- Modify: `src/lib/nfc/labels.ts`
- Modify: `src/lib/nfc/validation.ts`
- Modify: `src/lib/nfc/validation.test.ts`
- Modify: `src/lib/nfc/security.test.ts`
- Modify: `src/lib/nfc/server.ts`
- Modify: `src/lib/nfc/public-url.ts`
- Modify: `src/components/nfc/nfc-tag-form.tsx`
- Modify: `src/components/nfc/nfc-public-client.tsx`
- Create: `src/lib/profiles/cards.ts`
- Create: `src/lib/profiles/cards.test.ts`
- Create: `src/app/api/nfc/profiles/[id]/cards/route.ts`
- Create: `src/app/api/nfc/profiles/cards/[cardId]/route.ts`
- Create: `src/app/api/nfc/profiles/cards/[cardId]/qr/route.ts`
- Create: `src/components/nfc/profiles/profile-cards-panel.tsx`

- [x] **Step 1: Write failing NFC contract tests**

Add `professional_profile` to `NFC_ACTION_TYPES` and `profileId?: string` to `NfcActionConfig`. Assert:

- action requires a valid profile UUID;
- only published profiles can activate a card;
- public NFC resolution does not expose private profile fields;
- deactivated/replaced cards do not redirect;
- QR URL is `/t/<token>?source=qr`;
- programmed NFC URL is `/t/<token>?source=nfc`;
- base URL remains `https://marketing-system-xi.vercel.app` outside local development.

- [x] **Step 2: Implement card repository operations**

Expose:

```ts
listProfileCards(profileId: string): Promise<ProfessionalProfileCard[]>
createProfileCard(profileId: string, input, actorId: string): Promise<ProfessionalProfileCard>
setProfileCardStatus(cardId: string, status: ProfileCardStatus, actorId: string): Promise<void>
getProfileCardQrPayload(cardId: string): Promise<{ url: string; png: Buffer }>
```

Replacing a card must retire the former active card in the same transaction and preserve its history.

- [x] **Step 3: Extend NFC validation and execution**

`resolvePublicNfcTag` returns a profile action containing only current slug/display name/locale hint. Execution for `professional_profile` records the scan best-effort and redirects to:

```text
/perfil/<slug>?source=nfc
```

The transition screen displays “Abrindo o perfil de <nome>” and never a generic action label.

- [x] **Step 4: Extend the NFC tag form**

Add “Perfil profissional” to action type. The profile selector shows photo, name, role and publication status, is searchable and responsive. Draft profiles may be linked as pending but cannot activate a card.

- [x] **Step 5: Build the editor card panel**

Show internal card code, label, NFC tag, status, creation/issue/activation/retirement dates, replaced-card history, permanent NFC URL, QR preview/download, activate, replace and deactivate actions.

- [x] **Step 6: Run NFC and card tests**

```powershell
npm.cmd test -- src/lib/nfc/validation.test.ts src/lib/nfc/security.test.ts src/lib/profiles/cards.test.ts
npm.cmd run lint -- src/lib/nfc src/components/nfc src/app/api/nfc/profiles
npx.cmd tsc --noEmit
```

Expected: PASS.

- [x] **Step 7: Commit NFC integration**

```powershell
git add src/lib/nfc src/lib/profiles/cards.ts src/lib/profiles/cards.test.ts src/components/nfc src/app/api/nfc/profiles
git commit -m "feat: connect profiles to NFC cards"
```

---

## Task 12: Add privacy-safe event tracking, analytics and campaign controls

**Files:**

- Create: `src/lib/profiles/metrics.ts`
- Create: `src/lib/profiles/metrics.test.ts`
- Create: `src/app/api/perfis/[slug]/events/route.ts`
- Create: `src/app/api/perfis/[slug]/events/events-api.test.ts`
- Create: `src/components/profiles/profile-event-link.tsx`
- Modify: `src/components/profiles/profile-contact-actions.tsx`
- Modify: `src/components/nfc/profiles/profile-editor-client.tsx`
- Create: `src/components/nfc/profiles/profile-analytics-panel.tsx`
- Create: `src/components/nfc/profiles/profile-campaign-settings.tsx`

- [x] **Step 1: Write failing metric-sanitization tests**

Accept only:

```ts
{
  eventType: ProfileEventType;
  source: ProfileEventSource;
  locale: ProfileLocale;
  cardId?: string;
}
```

Reject/strip arbitrary URL, message, phone, e-mail, IP, coordinates, user-agent and referrer fields. Unknown event types return 400. Database failure must not be surfaced to the public UI.

- [x] **Step 2: Implement best-effort metric recording**

Expose:

```ts
recordProfileEvent(input: {
  profileId: string;
  cardId?: string | null;
  eventType: ProfileEventType;
  source: ProfileEventSource;
  locale: ProfileLocale;
}): Promise<void>
```

The public API validates slug/profile publication and calls the rate-limited database function. It returns 204 even when the coarse limit is reached or the insert fails after validation. Log only a stable error code and profile ID.

- [x] **Step 3: Wire public events**

- server-render visit: `profile_view`;
- `/t` entry: `nfc_scan` or `qr_scan`;
- vCard endpoint: `contact_download`;
- share success/copy fallback: `share`;
- external buttons: matching click type.

Use `navigator.sendBeacon` or `fetch(..., { keepalive: true })` for browser events.

- [x] **Step 4: Build analytics**

The profile admin panel shows:

- total views;
- NFC vs QR scans;
- contact downloads;
- WhatsApp/e-mail/LinkedIn/site clicks;
- daily trend for the selected period;
- card-level scans.

Default to the last 30 days. Aggregation is server-side; no raw event dump is needed in the UI.

- [x] **Step 5: Build global campaign controls**

Under `/nfc/perfis`, add:

- manual enabled switch;
- start/end date-time;
- PT/EN title, message and call to action;
- live state explanation.

Manual off overrides an active date range. Invalid end-before-start is rejected.

- [x] **Step 6: Run focused and regression tests**

```powershell
npm.cmd test -- src/lib/profiles/metrics.test.ts src/app/api/perfis/[slug]/events/events-api.test.ts src/lib/profiles/campaign.test.ts
npm.cmd run lint -- src/lib/profiles src/app/api/perfis src/components/profiles src/components/nfc/profiles
npx.cmd tsc --noEmit
```

Expected: PASS.

- [x] **Step 7: Commit metrics and campaign**

```powershell
git add src/lib/profiles src/app/api/perfis src/components/profiles src/components/nfc/profiles
git commit -m "feat: add profile metrics and campaign controls"
```

---

## Task 13: Run integration, accessibility and mobile verification

**Files:**

- Create: `tests/e2e/professional-profiles.spec.ts` if the repository’s browser-test convention exists at execution time
- Otherwise create: `src/lib/profiles/integration.test.ts`
- Modify only files revealed by failures

- [x] **Step 1: Add the end-to-end acceptance scenario**

  Covered in `src/lib/profiles/integration.test.ts` (no Playwright suite under `tests/e2e`). Module/acceptance tests compose pure helpers for:

1. non-admin cannot pass `assertProfileAdminRole` (auth gate);
2. import preview groups create/update/unmatched;
3. applied import payload has no publish status (rows remain draft by contract);
4. editor save payload keeps PT and partial EN without wiping;
5. hidden phone absent in public projection;
6. draft → null public resolution;
7. published resolves (`kind: "profile"`);
8. old slug → `kind: "redirect"`;
9. NFC `professional_profile` transition label uses display name;
10. QR URL retains `source=qr`;
11. vCard only visible contacts;
12. hidden recent content removed by aggregator;
13. campaign manual off overrides schedule;
14. metrics failure does not throw (`recordProfileEvent` / sanitize).

- [x] **Step 2: Run the automated profiles suite**

```powershell
npm.cmd test -- src/lib/profiles
```

Expected: exit 0 (171 tests). Full monorepo `npm test` / lint / `tsc` / `build` left for human or Task 15 — not required to close the module acceptance coverage.

- [ ] **Step 3: Run browser verification at desktop and mobile widths** *(requires human)*

Start:

```powershell
npm.cmd run dev
```

Verify admin at 1440×900 and 390×844; public at 1440×900, 390×844 and 320×568. Check keyboard navigation, visible focus, labels, contrast, 44 px touch targets, reduced motion, no horizontal overflow, image alt text and error/loading/empty states. Also confirm login UI blocks non-admin from `/nfc/perfis`.

- [ ] **Step 4: Verify real NFC/QR transition behavior** *(requires human + device)*

Use a non-production test tag/card. Confirm Android/iOS-compatible URL, correct production base, readable transition, published profile resolution and deactivated-card failure state.

- [x] **Step 5: Commit verification coverage and fixes**

```powershell
git add src/lib/profiles/integration.test.ts
git commit -m "test: verify professional profile journeys"
```

Docs commit: `docs: mark Perfis NFC task 13 complete`.

---

## Task 14: Apply migration and perform the controlled collaborator import

**Files:**

- Source data, read-only: `C:\Users\Leonardo Marques\Downloads\Colaboradores-MKT.xlsm`
- No generated source file should be committed

- [ ] **Step 1: Apply the reviewed migration**

Use the connected Supabase project and `SUPABASE_MANAGEMENT_ACCESS_TOKEN` through its existing environment/credential flow. Never print the token. Apply only the new professional-profile migration.

- [ ] **Step 2: Run Supabase advisors**

Review security and performance findings. Fix any new RLS, function search-path, missing-index or policy issue before continuing.

- [ ] **Step 3: Preview the real workbook**

Upload `Colaboradores-MKT.xlsm` through the admin preview. Expected source baseline from prior inspection: 91 rows, 54 active and 37 inactive. Investigate rather than apply if counts differ materially.

Verify:

- matching by normalized corporate email;
- no date-of-birth field in preview payload;
- no proposed user deactivation;
- no role/permission mutation;
- inactive rows unselected by default;
- unmatched rows clearly listed.

- [ ] **Step 4: Apply selected active rows as drafts**

Apply only reviewed matches. Re-run the preview afterward; expected: selected matches move to unchanged/update as appropriate, with zero duplicate profile per user and zero published profile created by import.

- [ ] **Step 5: Prepare two pilot profiles without broad publication**

Complete two representative profiles in PT and EN, link test cards and validate preview. Keep every other imported profile as draft. Publish pilot profiles only after the user approves their content; the implementation itself must not guess public professional copy.

- [ ] **Step 6: Record the import verification**

Capture counts in the task handoff: created, updated, unchanged, unmatched, inactive skipped, and published. Do not commit the workbook or exported personal data.

---

## Task 15: Final review, GitHub publication and Vercel production verification

**Files:**

- Review all changed files
- Do not modify unrelated working-tree paths

- [ ] **Step 1: Review the implementation against the design specification**

Compare with:

```text
docs/superpowers/specs/2026-07-28-perfis-nfc-design.md
```

Confirm all approved decisions, privacy constraints, noindex behavior, PT/EN fallback, card history, metrics and rollout gates are present.

- [ ] **Step 2: Run final verification from a clean source state**

```powershell
git status --short
npm.cmd test
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

Expected: only intentional changes/untracked user files appear; all validation commands exit 0.

- [ ] **Step 3: Request code review and resolve findings**

Use `superpowers:requesting-code-review`. Address only verified actionable findings, rerun focused tests after each correction, then rerun the full suite.

- [ ] **Step 4: Confirm fast-forward publication safety**

```powershell
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git status --short
```

Expected: ancestor command exits 0. Never force-push `main`.

- [ ] **Step 5: Publish through the approved GitHub flow**

Prefer a ready PR through the GitHub connector. If PR creation is unavailable and the existing authorization for direct official publication still applies, use:

```powershell
git push origin HEAD:main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

Expected: local HEAD and `origin/main` SHAs match. A failure in `gh auth status` alone is not a blocker when standard Git fetch/push works.

- [ ] **Step 6: Verify the Vercel deployment**

Wait for the production deployment to become `READY`, then verify:

- `https://marketing-system-xi.vercel.app/nfc/perfis` requires admin;
- one approved profile URL under `/perfil/<slug>` renders;
- response metadata contains noindex/nofollow;
- NFC and QR URLs use the production origin;
- vCard downloads correctly;
- runtime logs contain no new profile/NFC errors.

- [ ] **Step 7: Deliver the final handoff**

Report:

- production URL and deployment state;
- migration and import counts;
- published/draft counts;
- tested pilot slugs/cards;
- test/lint/typecheck/build results;
- final Git SHA;
- any deliberately deferred profile content awaiting editorial approval.
