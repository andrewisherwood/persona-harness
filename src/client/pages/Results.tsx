import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi.js";
import "./Results.css";

interface RunEntry {
  id: string;
  config: { personas?: string[]; mode?: string };
  summary: { overall_pass?: boolean } | null;
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
              <span
                className={`badge badge-${run.summary?.overall_pass ? "pass" : "fail"}`}
              >
                {run.summary?.overall_pass
                  ? "PASS"
                  : run.summary
                    ? "FAIL"
                    : "\u2014"}
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
