# Instagram Reel Card no Perfil Público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir links válidos de Reels do Instagram como um card audiovisual reconhecível no perfil público, com player oficial, capa, botão de reprodução e link externo de segurança.

**Architecture:** Um helper puro e isolado valida a origem e extrai o shortcode do Reel, produzindo somente URLs canônicas do endpoint oficial `/embed/`. O componente `ProfileSectionList` usa esse resultado para renderizar o card apenas em entradas compatíveis; todos os demais links preservam o comportamento existente.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Vitest e `react-dom/server`.

## Global Constraints

- Incorporar somente URLs `http` ou `https` dos hosts exatos `instagram.com` e `www.instagram.com`.
- Aceitar caminhos `/reel/<shortcode>` e `/reels/<shortcode>`.
- Produzir `https://www.instagram.com/reel/<shortcode>/embed/` sem parâmetros.
- Manter a URL original no botão “Assistir no Instagram”.
- Não consultar a API do Instagram, exigir token ou alterar o banco de dados.
- Preservar a renderização atual de links que não sejam Reels.
- Manter o card responsivo e contido no perfil público.

---

## File Structure

- Create: `src/components/profiles/profile-instagram-reel.ts` — valida URLs e cria o endereço oficial de incorporação.
- Create: `src/components/profiles/profile-instagram-reel.test.ts` — cobre URLs válidas e origens não permitidas.
- Create: `src/components/profiles/profile-section-list.test.tsx` — testa o card real e links comuns.
- Modify: `src/components/profiles/profile-section-list.tsx` — renderiza o player e o fallback.
- Modify: `src/components/profiles/professional-profile-page.module.css` — estiliza o card vertical.

### Task 1: Reconhecer URLs válidas de Reels

**Files:**
- Create: `src/components/profiles/profile-instagram-reel.ts`
- Create: `src/components/profiles/profile-instagram-reel.test.ts`

**Interfaces:**
- Consumes: `linkUrl: string | null | undefined`.
- Produces: `buildInstagramReelEmbedUrl(linkUrl): string | null`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildInstagramReelEmbedUrl } from "@/components/profiles/profile-instagram-reel";

describe("buildInstagramReelEmbedUrl", () => {
  it("converte Reel público em URL canônica de incorporação", () => {
    expect(
      buildInstagramReelEmbedUrl(
        "https://www.instagram.com/reel/DAtegZsygMk/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ=="
      )
    ).toBe("https://www.instagram.com/reel/DAtegZsygMk/embed/");
  });

  it("aceita o caminho reels e o host sem www", () => {
    expect(
      buildInstagramReelEmbedUrl("https://instagram.com/reels/AbC_123-xyz")
    ).toBe("https://www.instagram.com/reel/AbC_123-xyz/embed/");
  });

  it.each([
    "https://instagram.com.evil.example/reel/DAtegZsygMk/",
    "https://www.instagram.com/p/DAtegZsygMk/",
    "javascript:alert(1)",
    "",
  ])("não incorpora uma URL não permitida: %s", (url) => {
    expect(buildInstagramReelEmbedUrl(url)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/profiles/profile-instagram-reel.test.ts
```

Expected: FAIL porque o módulo e a função ainda não existem.

- [ ] **Step 3: Implement the minimal safe parser**

```ts
const INSTAGRAM_REEL_PATH = /^\/(?:reel|reels)\/([A-Za-z0-9_-]+)\/?$/;
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

export function buildInstagramReelEmbedUrl(
  linkUrl: string | null | undefined
): string | null {
  if (!linkUrl) return null;

  try {
    const url = new URL(linkUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;

    const shortcode = url.pathname.match(INSTAGRAM_REEL_PATH)?.[1];
    if (!shortcode) return null;

    return `https://www.instagram.com/reel/${shortcode}/embed/`;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/components/profiles/profile-instagram-reel.test.ts
```

Expected: PASS para os seis casos de teste.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/profiles/profile-instagram-reel.ts src/components/profiles/profile-instagram-reel.test.ts
git commit -m "feat(perfis): reconhece links publicos de Reels"
```

### Task 2: Renderizar o card audiovisual no perfil

**Files:**
- Create: `src/components/profiles/profile-section-list.test.tsx`
- Modify: `src/components/profiles/profile-section-list.tsx`
- Modify: `src/components/profiles/professional-profile-page.module.css`

**Interfaces:**
- Consumes: `buildInstagramReelEmbedUrl(linkUrl): string | null` e `PublicProfessionalProfile`.
- Produces: `.pp-section__reel`, `iframe.pp-section__reel-frame` e `a.pp-section__reel-cta`.

- [ ] **Step 1: Write the failing component tests**

Crie um fixture mínimo de `PublicProfessionalProfile` com seção `timeline` e execute o componente real:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileSectionList } from "@/components/profiles/profile-section-list";
import type { PublicProfessionalProfile } from "@/lib/profiles/types";

const reelUrl =
  "https://www.instagram.com/reel/DAtegZsygMk/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ==";

function profileWithLink(linkUrl: string): PublicProfessionalProfile {
  return {
    id: "p-carlos",
    slug: "carlos-zamboni",
    locale: "pt-BR",
    identity: {
      name: "Carlos Zamboni",
      role: "Consultor em Liderança e Gestão Estratégica",
      practiceArea: "Liderança, Gestão Estratégica e Transformação Organizacional",
      oab: null,
      photoUrl: null,
      tagline: "Liderar é inspirar, transformar e construir um legado.",
      bio: "Consultor com mais de 35 anos de experiência em liderança.",
      joinedOn: null,
      tenureLabel: null,
    },
    contacts: {
      email: null,
      whatsapp: null,
      linkedinUrl: null,
      websiteUrl: null,
    },
    sections: [{
      key: "timeline",
      entries: [{
        id: "entry-reel",
        entryType: "milestone",
        title: "Reconhecimento à trajetória na CPFL Energia",
        subtitle: null,
        description: "Registro da despedida e do reconhecimento das equipes.",
        linkUrl,
        imageUrl: null,
        occurredOn: null,
      }],
    }],
    recentContent: [],
    campaignMessage: null,
    campaignTitle: null,
  };
}

describe("ProfileSectionList — Reels", () => {
  it("mostra player oficial e fallback externo para um Reel", () => {
    const markup = renderToStaticMarkup(
      <ProfileSectionList profile={profileWithLink(reelUrl)} />
    );

    expect(markup).toContain('class="pp-section__reel-frame"');
    expect(markup).toContain(
      'src="https://www.instagram.com/reel/DAtegZsygMk/embed/"'
    );
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain(
      'title="Reel: Reconhecimento à trajetória na CPFL Energia"'
    );
    expect(markup).toContain("Assistir no Instagram");
  });

  it("preserva link textual e não cria iframe para links comuns", () => {
    const markup = renderToStaticMarkup(
      <ProfileSectionList profile={profileWithLink("https://example.com/artigo")} />
    );

    expect(markup).toContain('href="https://example.com/artigo"');
    expect(markup).not.toContain("pp-section__reel-frame");
    expect(markup).not.toContain("Assistir no Instagram");
  });
});
```

- [ ] **Step 2: Run the component tests to verify RED**

Run:

```bash
npm test -- src/components/profiles/profile-section-list.test.tsx
```

Expected: FAIL porque o componente ainda não produz o player nem a chamada.

- [ ] **Step 3: Implement the Reel rendering**

Importe `buildInstagramReelEmbedUrl`, derive `reelEmbedUrl` para cada entrada e preserve o título como texto forte quando houver card. Após o texto da entrada, renderize:

```tsx
{reelEmbedUrl && entry.linkUrl ? (
  <div className="pp-section__reel">
    <iframe
      className="pp-section__reel-frame"
      src={reelEmbedUrl}
      title={`Reel: ${entry.title}`}
      loading="lazy"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
    <a
      className="pp-section__reel-cta"
      href={entry.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span aria-hidden="true">▶</span>
      Assistir no Instagram
    </a>
  </div>
) : null}
```

Para links comuns, preserve o ramo atual de `a.pp-section__link`.

- [ ] **Step 4: Style the responsive visual card**

Adicione ao CSS Module:

```css
.root :global(.pp-section__reel) {
  width: min(100%, 390px);
  margin-top: 1rem;
  overflow: hidden;
  border: 1px solid var(--pp-line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 42px -34px rgba(6, 21, 37, 0.7);
}

.root :global(.pp-section__reel-frame) {
  display: block;
  width: 100%;
  aspect-ratio: 9 / 16;
  border: 0;
  background: var(--pp-ink);
}

.root :global(.pp-section__reel-cta) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 2.9rem;
  padding: 0.65rem 1rem;
  color: var(--pp-ink);
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
}

.root :global(.pp-section__reel-cta:hover) {
  color: var(--pp-gold-decorative);
}

.root :global(.pp-section__reel-cta:focus-visible) {
  outline: 3px solid var(--pp-gold);
  outline-offset: -3px;
}
```

- [ ] **Step 5: Run focused tests to verify GREEN**

Run:

```bash
npm test -- src/components/profiles/profile-instagram-reel.test.ts src/components/profiles/profile-section-list.test.tsx src/components/profiles/professional-profile-page.test.tsx
```

Expected: PASS para o helper, o card e a página pública existente.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/components/profiles/profile-section-list.test.tsx src/components/profiles/profile-section-list.tsx src/components/profiles/professional-profile-page.module.css
git commit -m "feat(perfis): exibe card visual para Reels"
```

### Task 3: Verificação completa e publicação

**Files:**
- Verify only: arquivos das Tasks 1 e 2.

**Interfaces:**
- Consumes: árvore Git com os commits das Tasks 1 e 2.
- Produces: build validado, commit publicado no `main` e perfil verificado em produção.

- [ ] **Step 1: Run the complete test suite**

```bash
npm test
```

Expected: todas as suítes aprovadas.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 3: Confirm the publication scope**

```bash
git status -sb
git diff --check
git log --oneline origin/main..HEAD
git diff --name-status origin/main..HEAD
```

Expected: somente a especificação, o plano e os arquivos do card aparecem nos commits; alterações de Eventos ficam fora do stage.

- [ ] **Step 4: Publish by fast-forward**

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
```

Expected: ancestralidade retorna 0 e o push atualiza `main` sem force-push.

- [ ] **Step 5: Wait for Vercel and verify production**

Aguarde o status `success` da Vercel e consulte:

```bash
curl -L "https://marketing-system-xi.vercel.app/perfil/carlos-zamboni?source=nfc"
```

Expected: HTTP 200 e HTML contendo:

```text
https://www.instagram.com/reel/DAtegZsygMk/embed/
pp-section__reel-frame
Assistir no Instagram
```

- [ ] **Step 6: Visual smoke test**

Abra o perfil em largura desktop e mobile. Confirme que o player mostra a capa e o botão de reprodução, fica contido no cartão e mantém o botão “Assistir no Instagram” visível.
