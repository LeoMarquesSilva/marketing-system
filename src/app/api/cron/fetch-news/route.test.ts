import { beforeEach, describe, expect, it, vi } from "vitest";

const runFetchPipeline = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content-roteiros", () => ({ runFetchPipeline }));

import { GET } from "./route";

describe("GET /api/cron/fetch-news", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
  });

  it("não inicia o pipeline sem o bearer correto", async () => {
    const response = await GET(
      new Request("https://example.com/api/cron/fetch-news", {
        headers: { "x-vercel-cron": "1" },
      })
    );

    expect(response.status).toBe(401);
    expect(runFetchPipeline).not.toHaveBeenCalled();
  });

  it("aguarda o pipeline e devolve o resultado concluído", async () => {
    let finishPipeline!: (result: {
      created: number;
      skipped: number;
      errors: string[];
    }) => void;
    runFetchPipeline.mockReturnValueOnce(
      new Promise((resolve) => {
        finishPipeline = resolve;
      })
    );

    let requestFinished = false;
    const responsePromise = GET(
      new Request("https://example.com/api/cron/fetch-news", {
        headers: { Authorization: "Bearer cron-test-secret" },
      })
    ).then((response) => {
      requestFinished = true;
      return response;
    });

    await Promise.resolve();
    expect(requestFinished).toBe(false);

    finishPipeline({ created: 4, skipped: 7, errors: [] });
    const response = await responsePromise;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      created: 4,
      skipped: 7,
    });
    expect(runFetchPipeline).toHaveBeenCalledWith(undefined, undefined, {
      maxCreated: 10,
      trigger: "cron",
    });
  });
});
