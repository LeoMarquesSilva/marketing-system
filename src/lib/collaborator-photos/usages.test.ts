import { describe, expect, it } from "vitest";
import {
  assignPhotoUsage,
  clearPhotoUsage,
  usagesRemainingAfterPhotoDelete,
  shouldClearOfficialProjection,
  canDeleteCollaboratorPhoto,
} from "@/lib/collaborator-photos/usages";
import type { PhotoUsageAssignment } from "@/lib/collaborator-photos/types";

const OFICIAL = "oficial";
const POSTS = "posts";
const SITE = "site-materiais";

function assignment(
  usageTypeSlug: string,
  photoId: string,
  userId = "user-a"
): PhotoUsageAssignment {
  return { userId, usageTypeSlug, photoId };
}

describe("assignPhotoUsage", () => {
  it("liga um uso a uma foto", () => {
    const next = assignPhotoUsage([], assignment(POSTS, "foto-1"));
    expect(next).toEqual([assignment(POSTS, "foto-1")]);
  });

  it("permite a mesma foto em vários usos", () => {
    const withPosts = assignPhotoUsage([], assignment(POSTS, "foto-1"));
    const next = assignPhotoUsage(withPosts, assignment(OFICIAL, "foto-1"));
    expect(next).toEqual([
      assignment(POSTS, "foto-1"),
      assignment(OFICIAL, "foto-1"),
    ]);
  });

  it("move o uso para a foto atual quando outra já o tinha", () => {
    const current = [assignment(POSTS, "foto-1")];
    const next = assignPhotoUsage(current, assignment(POSTS, "foto-2"));
    expect(next).toEqual([assignment(POSTS, "foto-2")]);
  });

  it("é idempotente se a foto já tem aquele uso", () => {
    const current = [assignment(POSTS, "foto-1")];
    expect(assignPhotoUsage(current, assignment(POSTS, "foto-1"))).toEqual(current);
  });
});

describe("clearPhotoUsage", () => {
  it("desliga o uso só na foto informada", () => {
    const current = [
      assignment(POSTS, "foto-1"),
      assignment(OFICIAL, "foto-1"),
    ];
    expect(clearPhotoUsage(current, assignment(POSTS, "foto-1"))).toEqual([
      assignment(OFICIAL, "foto-1"),
    ]);
  });

  it("não mexe se o uso está em outra foto", () => {
    const current = [assignment(POSTS, "foto-2")];
    expect(clearPhotoUsage(current, assignment(POSTS, "foto-1"))).toEqual(current);
  });
});

describe("usagesRemainingAfterPhotoDelete", () => {
  it("remove todos os usos da foto apagada", () => {
    const current = [
      assignment(POSTS, "foto-1"),
      assignment(OFICIAL, "foto-1"),
      assignment(SITE, "foto-2"),
    ];
    expect(usagesRemainingAfterPhotoDelete(current, "foto-1")).toEqual([
      assignment(SITE, "foto-2"),
    ]);
  });
});

describe("shouldClearOfficialProjection", () => {
  it("limpa avatar/NFC só quando a URL atual é a da foto apagada", () => {
    expect(
      shouldClearOfficialProjection({
        currentAvatarUrl: "https://cdn/foto-1.jpg",
        deletedPhotoUrl: "https://cdn/foto-1.jpg",
        deletedPhotoWasOfficial: true,
      })
    ).toBe(true);
  });

  it("não limpa se a oficial apagada não era a URL atual", () => {
    expect(
      shouldClearOfficialProjection({
        currentAvatarUrl: "https://cdn/outra.jpg",
        deletedPhotoUrl: "https://cdn/foto-1.jpg",
        deletedPhotoWasOfficial: true,
      })
    ).toBe(false);
  });

  it("não limpa se a foto apagada não era oficial", () => {
    expect(
      shouldClearOfficialProjection({
        currentAvatarUrl: "https://cdn/foto-1.jpg",
        deletedPhotoUrl: "https://cdn/foto-1.jpg",
        deletedPhotoWasOfficial: false,
      })
    ).toBe(false);
  });
});

describe("canDeleteCollaboratorPhoto", () => {
  it("permite o dono e o marketing apagarem, e bloqueia terceiro", () => {
    expect(canDeleteCollaboratorPhoto({ actorId: "a", photoUserId: "a", isManager: false })).toBe(
      true
    );
    expect(canDeleteCollaboratorPhoto({ actorId: "mkt", photoUserId: "a", isManager: true })).toBe(
      true
    );
    expect(canDeleteCollaboratorPhoto({ actorId: "b", photoUserId: "a", isManager: false })).toBe(
      false
    );
  });
});
