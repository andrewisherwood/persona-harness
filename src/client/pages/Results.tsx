import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi.js";
import "./Results.css";

interface PersonaResult {
  error?: string | null;
  previewUrl?: string | null;
  evaluation?: { overall_pass?: boolean } | null;
}

interface RunEntry {
  id: string;
  config: { personas?: string[]; mode?: string };
  summary: {
    personas?: Record<string, PersonaResult>;
  } | null;
}

function deriveRunStatus(run: RunEntry): "pass" | "fail" | "pending" {
  if (!run.summary?.personas) return "pending";
  const results = Object.values(run.summary.personas);
  if (results.length === 0) return "pending";
  const allSucceeded = results.every((r) => !r.error);
  return allSucceeded ? "pass" : "fail";
}

export function Results() {
  const { data: runs, loading } = useApi<RunEntry[]>("/runs");

  if (loading) return <div className="loading">Loading runs...</div>;

  return (
    <div className="results-page">
      <h2>Results</h2>
      <div className="results-list">
        {runs?.map((run) => {
          const personaCount = run.config?.personas?.length ?? 0;
          const mode = run.config?.mode ?? "unknown";
          const status = deriveRunStatus(run);
          return (
            <Link
              key={run.id}
              to={`/results/${run.id}`}
              className="card result-card"
            >
              <div className="result-info">
                <strong className="result-id">{run.id}</strong>
                <span className="result-meta">
                  {personaCount} persona{personaCount !== 1 ? "s" : ""} &middot;{" "}
                  {mode}
                </span>
              </div>
              <span className={`badge badge-${status === "pending" ? "running" : status}`}>
                {status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "\u2014"}
              </span>
            </Link>
          );
        })}
        {(!runs || runs.length === 0) && (
          <p className="empty-state">
            No runs yet. Start one from the <Link to="/">Run page</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
