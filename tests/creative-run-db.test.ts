import { describe, it, expect, vi } from "vitest";
import {
  insertCreativeRun,
  updateCreativeRunStatus,
  insertCreativeRunPage,
  listCreativeRuns,
  getCreativeRun,
  getCreativeRunPages,
} from "../src/server/engine/creative-run-db.js";
import type { CreativeRunInsert, CreativeRunPageInsert } from "../src/server/engine/creative-run-types.js";

function createMockChain(resolvedValue: { data: unknown; error: unknown }) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
  };
  return chain;
}

function createMockClient(chain: ReturnType<typeof createMockChain>) {
  return { from: vi.fn().mockReturnValue(chain) } as never;
}

const sampleRunInsert: CreativeRunInsert = {
  model_provider: "anthropic",
  model_name: "claude-opus-4-6",
  temperature: 0.7,
  max_tokens: 16384,
  palette: "sage_sand",
  typography: "mixed",
  style: "classic",
  brand_feeling: "Reassuring",
  site_spec_name: "Dina Hart Birth Services",
  site_spec_snapshot: { business_name: "Test" },
};

const samplePageInsert: CreativeRunPageInsert = {
  run_id: "run-abc",
  page_name: "home",
  html: "<html></html>",
};

describe("creative-run-db", () => {
  describe("insertCreativeRun", () => {
    it("inserts into creative_runs and returns the generated ID", async () => {
      const chain = createMockChain({ data: { id: "run-123" }, error: null });
      const client = createMockClient(chain);

      const id = await insertCreativeRun(client, sampleRunInsert);

      expect(id).toBe("run-123");
      expect(client.from).toHaveBeenCalledWith("creative_runs");
      expect(chain.insert).toHaveBeenCalledWith(sampleRunInsert);
      expect(chain.select).toHaveBeenCalledWith("id");
      expect(chain.single).toHaveBeenCalled();
    });

    it("throws on Supabase error", async () => {
      const chain = createMockChain({ data: null, error: { message: "RLS violation" } });
      const client = createMockClient(chain);

      await expect(insertCreativeRun(client, sampleRunInsert))
        .rejects.toThrow("Failed to insert creative run: RLS violation");
    });
  });

  describe("updateCreativeRunStatus", () => {
    it("updates status on the correct table and row", async () => {
      const chain = createMockChain({ data: null, error: null });
      // updateCreativeRunStatus does not call .single(), so make eq resolve directly
      chain.eq.mockResolvedValue({ data: null, error: null });
      const client = createMockClient(chain);

      await updateCreativeRunStatus(client, "run-123", "complete", {
        preview_url: "https://example.netlify.app",
        estimated_cost_usd: 6.55,
      });

      expect(client.from).toHaveBeenCalledWith("creative_runs");
      expect(chain.update).toHaveBeenCalledWith({
        status: "complete",
        preview_url: "https://example.netlify.app",
        estimated_cost_usd: 6.55,
      });
      expect(chain.eq).toHaveBeenCalledWith("id", "run-123");
    });

    it("updates status without optional results", async () => {
      const chain = createMockChain({ data: null, error: null });
      chain.eq.mockResolvedValue({ data: null, error: null });
      const client = createMockClient(chain);

      await updateCreativeRunStatus(client, "run-123", "generating");

      expect(chain.update).toHaveBeenCalledWith({ status: "generating" });
    });

    it("throws on Supabase error", async () => {
      const chain = createMockChain({ data: null, error: null });
      chain.eq.mockResolvedValue({ data: null, error: { message: "not found" } });
      const client = createMockClient(chain);

      await expect(updateCreativeRunStatus(client, "run-123", "error"))
        .rejects.toThrow("Failed to update creative run: not found");
    });
  });

  describe("insertCreativeRunPage", () => {
    it("inserts into creative_run_pages and returns the generated ID", async () => {
      const chain = createMockChain({ data: { id: "page-456" }, error: null });
      const client = createMockClient(chain);

      const id = await insertCreativeRunPage(client, samplePageInsert);

      expect(id).toBe("page-456");
      expect(client.from).toHaveBeenCalledWith("creative_run_pages");
      expect(chain.insert).toHaveBeenCalledWith(samplePageInsert);
      expect(chain.select).toHaveBeenCalledWith("id");
      expect(chain.single).toHaveBeenCalled();
    });

    it("throws on Supabase error", async () => {
      const chain = createMockChain({ data: null, error: { message: "FK violation" } });
      const client = createMockClient(chain);

      await expect(insertCreativeRunPage(client, samplePageInsert))
        .rejects.toThrow("Failed to insert creative run page: FK violation");
    });
  });

  describe("listCreativeRuns", () => {
    it("returns runs ordered by created_at descending", async () => {
      const runs = [{ id: "run-1" }, { id: "run-2" }];
      const chain = createMockChain({ data: null, error: null });
      // listCreativeRuns chains select -> order (no single), so order returns the result
      chain.order.mockResolvedValue({ data: runs, error: null });
      const client = createMockClient(chain);

      const result = await listCreativeRuns(client);

      expect(result).toEqual(runs);
      expect(client.from).toHaveBeenCalledWith("creative_runs");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });

    it("returns empty array when no data", async () => {
      const chain = createMockChain({ data: null, error: null });
      chain.order.mockResolvedValue({ data: null, error: null });
      const client = createMockClient(chain);

      const result = await listCreativeRuns(client);

      expect(result).toEqual([]);
    });

    it("throws on Supabase error", async () => {
      const chain = createMockChain({ data: null, error: null });
      chain.order.mockResolvedValue({ data: null, error: { message: "timeout" } });
      const client = createMockClient(chain);

      await expect(listCreativeRuns(client))
        .rejects.toThrow("Failed to list creative runs: timeout");
    });
  });

  describe("getCreativeRun", () => {
    it("returns a single run by ID", async () => {
      const run = { id: "run-1", status: "complete" };
      const chain = createMockChain({ data: run, error: null });
      const client = createMockClient(chain);

      const result = await getCreativeRun(client, "run-1");

      expect(result).toEqual(run);
      expect(client.from).toHaveBeenCalledWith("creative_runs");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("id", "run-1");
      expect(chain.single).toHaveBeenCalled();
    });

    it("throws when run not found", async () => {
      const chain = createMockChain({ data: null, error: { message: "row not found" } });
      const client = createMockClient(chain);

      await expect(getCreativeRun(client, "missing"))
        .rejects.toThrow("Creative run not found: row not found");
    });
  });

  describe("getCreativeRunPages", () => {
    it("returns pages for a run ordered by created_at ascending", async () => {
      const pages = [{ id: "p-1", page_name: "home" }, { id: "p-2", page_name: "about" }];
      const chain = createMockChain({ data: null, error: null });
      // Chain: select -> eq -> order (no single)
      chain.order.mockResolvedValue({ data: pages, error: null });
      const client = createMockClient(chain);

      const result = await getCreativeRunPages(client, "run-1");

      expect(result).toEqual(pages);
      expect(client.from).toHaveBeenCalledWith("creative_run_pages");
      expect(chain.select).toHaveBeenCalledWith("*");
      expect(chain.eq).toHaveBeenCalledWith("run_id", "run-1");
      expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: true });
    });

    it("returns empty array when no pages exist", async () => {
      const chain = createMockChain({ data: null, error: null });
      chain.order.mockResolvedValue({ data: null, error: null });
      const client = createMockClient(chain);

      const result = await getCreativeRunPages(client, "run-1");

      expect(result).toEqual([]);
    });

    it("throws on Supabase error", async () => {
      const chain = createMockChain({ data: null, error: null });
      chain.order.mockResolvedValue({ data: null, error: { message: "permission denied" } });
      const client = createMockClient(chain);

      await expect(getCreativeRunPages(client, "run-1"))
        .rejects.toThrow("Failed to get creative run pages: permission denied");
    });
  });
});
