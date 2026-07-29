import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthGuard } from "@/components/auth/auth-guard";

const route = vi.hoisted(() => ({
  pathname: "/perfil/felipe-soares-de-camargo",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: true,
  }),
}));

describe("AuthGuard — SSR de rotas públicas", () => {
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
