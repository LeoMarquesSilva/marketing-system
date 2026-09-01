import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthGuard } from "@/components/auth/auth-guard";

const route = vi.hoisted(() => ({
  pathname: "/perfil/felipe-soares-de-camargo",
}));
const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as {
    department?: string | null;
    permissions?: string[] | null;
    ferias_view_enabled?: boolean | null;
  } | null,
  loading: true,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => authState,
}));

describe("AuthGuard — SSR de rotas públicas", () => {
  beforeEach(() => {
    authState.user = null;
    authState.profile = null;
    authState.loading = true;
  });

  it("renderiza o perfil profissional público enquanto a sessão inicializa", () => {
    route.pathname = "/perfil/felipe-soares-de-camargo";

    const markup = renderToStaticMarkup(
      <AuthGuard>
        <p>Conteúdo público NFC</p>
      </AuthGuard>
    );

    expect(markup).toContain("Conteúdo público NFC");
    expect(markup).not.toContain("Carregando...");
  });

  it("continua ocultando conteúdo protegido enquanto a sessão inicializa", () => {
    route.pathname = "/solicitacoes";

    const markup = renderToStaticMarkup(
      <AuthGuard>
        <p>Conteúdo protegido</p>
      </AuthGuard>
    );

    expect(markup).not.toContain("Conteúdo protegido");
    expect(markup).toContain("Carregando...");
  });
});

describe("AuthGuard — acesso parcial a Férias", () => {
  it("não redireciona colaborador de conteúdo que também é viewer de Férias", () => {
    route.pathname = "/rh/ferias";
    authState.user = { id: "viewer-1" };
    authState.profile = {
      department: "Cível",
      permissions: null,
      ferias_view_enabled: true,
    };
    authState.loading = false;

    const markup = renderToStaticMarkup(
      <AuthGuard>
        <p>Módulo de férias</p>
      </AuthGuard>
    );

    expect(markup).toContain("Módulo de férias");
    expect(markup).not.toContain("Redirecionando...");
  });
});

describe("AuthGuard — Posicionamento Gustavo", () => {
  it("redireciona colaborador de conteúdo sem membership", () => {
    route.pathname = "/conteudo/gustavo";
    authState.user = { id: "colab-1" };
    authState.profile = {
      department: "Cível",
      permissions: ["/conteudo/roteiros"],
    };
    authState.loading = false;

    const markup = renderToStaticMarkup(
      <AuthGuard>
        <p>Módulo do Gustavo</p>
      </AuthGuard>
    );

    expect(markup).not.toContain("Módulo do Gustavo");
    expect(markup).toContain("Redirecionando...");
  });
});

describe("AuthGuard — check-in do Café com Cultura", () => {
  it("não redireciona colaborador de conteúdo autenticado no check-in", () => {
    route.pathname = "/cafe-com-cultura";
    authState.user = { id: "colab-1" };
    authState.profile = {
      department: "Cível",
      permissions: ["/conteudo/roteiros"],
    };
    authState.loading = false;

    const markup = renderToStaticMarkup(
      <AuthGuard>
        <p>Check-in do café</p>
      </AuthGuard>
    );

    expect(markup).toContain("Check-in do café");
    expect(markup).not.toContain("Redirecionando...");
  });
});
