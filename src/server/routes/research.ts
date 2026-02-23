import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listCreativeRuns,
  getCreativeRun,
  getCreativeRunPages,
} from "../engine/creative-run-db.js";

export function createResearchRouter(supabaseClient: SupabaseClient) {
  const router = Router();

  // GET /api/research — list all creative runs
  router.get("/", async (_req, res) => {
    try {
      const runs = await listCreativeRuns(supabaseClient);
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/research/:id — get run detail with pages
  router.get("/:id", async (req, res) => {
    try {
      const [run, pages] = await Promise.all([
        getCreativeRun(supabaseClient, req.params.id),
        getCreativeRunPages(supabaseClient, req.params.id),
      ]);
      res.json({ run, pages });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
