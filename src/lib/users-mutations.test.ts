import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUser,
  deleteUser,
  toggleUserActive,
  updateOwnProfile,
  updateUser,
} from "./users";

describe("mutações seguras de usuários", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("atualiza o perfil próprio pela API de conta", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {
            id: "u1",
            name: "Leonardo",
            email: null,
            department: "Marketing",
            avatar_url: null,
            is_active: true,
          },
        }),
        { status: 200 }
      )
    );

    const result = await updateOwnProfile({ name: "Leonardo", email: null });

    expect(result.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Leonardo", email: null }),
    });
  });

  it("encaminha o CRUD administrativo para endpoints server-side", async () => {
    const user = {
      id: "u1",
      name: "Valentina",
      email: "valentina@example.com",
      department: "Marketing",
      avatar_url: null,
      is_active: true,
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ user }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await createUser({
      name: user.name,
      email: user.email,
      department: user.department,
      avatar_url: null,
    });
    await updateUser("u1", { department: "Marketing" });
    await toggleUserActive("u1");
    await deleteUser("u1");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/admin/users",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/api/admin/users/u1",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/admin/users/u1/toggle-active",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "/api/admin/users/u1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("propaga a mensagem de erro da API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Acesso negado." }), { status: 403 })
    );

    const result = await deleteUser("u1");

    expect(result).toEqual({ error: "Acesso negado." });
  });
});
