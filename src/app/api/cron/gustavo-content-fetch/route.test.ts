import { beforeEach, describe, expect, it, vi } from "vitest";

const runGustavoContentFetchPipeline = vi.hoisted(() => vi.fn());

vi.mock("@/lib/gustavo-content/pipeline", () => ({ runGustavoContentFetchPipeline }));

import { GET } from "./route";

describe("GET /api/cron/gustavo-content-fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-test-secret";
  });

  it("não inicia o pipeline sem o bearer correto", async () => {
    const response = await GET(new Request("https://example.com/api/cron/gustavo-content-fetch"));
    expect(response.status).toBe(401);
    expect(runGustavoContentFetchPipeline).not.toHaveBeenCalled();
  });

  it("roda o pipeline isolado do institucional", async () => {
    runGustavoContentFetchPipeline.mockResolvedValueOnce({
      itemsSeen: 3,
      discardedUnder55: 1,
      radarCreated: 1,
      suggestionsCreated: 1,
      duplicates: 0,
      errors: [],
    });
    const response = await GET(
      new Request("https://example.com/api/cron/gustavo-content-fetch", {
        headers: { Authorization: "Bearer cron-test-secret" },
      })
    );
    expect(response.status).toBe(200);
    expect(runGustavoContentFetchPipeline).toHaveBeenCalledWith({
      maxCreated: 8,
      trigger: "cron",
    });
  });
});
