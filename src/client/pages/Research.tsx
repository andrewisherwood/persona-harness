import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi.js";
import "./Research.css";

interface CreativeRunSummary {
  id: string;
  created_at: string;
  model_provider: string;
  model_name: string;
  palette: string;
  typography: string;
  style: string;
  brand_feeling: string;
  site_spec_name: string;
  preview_url: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_time_s: number | null;
  estimated_cost_usd: number | null;
  status: string;
}

export function Research() {
  const { data: runs, loading, error } = useApi<CreativeRunSummary[]>("/research");
  const [filterModel, setFilterModel] = useState("");
  const [filterPalette, setFilterPalette] = useState("");
  const [filterFeeling, setFilterFeeling] = useState("");

  if (loading) return <div className="loading">Loading research runs...</div>;
  if (error) return <div className="error-state">Error: {error}</div>;

  const filtered = (runs ?? []).filter((r) => {
    if (filterModel && r.model_name !== filterModel) return false;
    if (filterPalette && r.palette !== filterPalette) return false;
    if (filterFeeling && r.brand_feeling !== filterFeeling) return false;
    return true;
  });

  const models = [...new Set((runs ?? []).map((r) => r.model_name))];
  const palettes = [...new Set((runs ?? []).map((r) => r.palette))];
  const feelings = [...new Set((runs ?? []).map((r) => r.brand_feeling))];

  return (
    <div className="research-page">
      <div className="research-header">
        <h2>Creative Research</h2>
        <div className="research-header-actions">
          <Link to="/research/new" className="btn-primary">New Build</Link>
          <Link to="/research/compare" className="btn-secondary">Compare Runs</Link>
        </div>
      </div>
      <p className="research-subtitle">
        Systematic comparison of LLM-generated sites across models and style variables
      </p>

      <div className="research-filters card">
        <div className="filter-group">
          <label>Model</label>
          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
            <option value="">All models</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Palette</label>
          <select value={filterPalette} onChange={(e) => setFilterPalette(e.target.value)}>
            <option value="">All palettes</option>
            {palettes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Feeling</label>
          <select value={filterFeeling} onChange={(e) => setFilterFeeling(e.target.value)}>
            <option value="">All feelings</option>
            {feelings.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <span className="filter-count">{filtered.length} run{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="research-list">
        {filtered.map((run) => (
          <Link key={run.id} to={`/research/${run.id}`} className="card research-card">
            <div className="research-card-header">
              <span className="research-model">{run.model_name}</span>
              <span className={`badge badge-${run.status === "complete" ? "pass" : run.status === "error" ? "fail" : "running"}`}>
                {run.status}
              </span>
            </div>
            <div className="research-card-vars">
              <span className="var-pill">{run.palette}</span>
              <span className="var-pill">{run.style}</span>
              <span className="var-pill">{run.typography}</span>
              <span className="var-pill">{run.brand_feeling}</span>
            </div>
            <div className="research-card-footer">
              <span className="research-meta">
                {run.estimated_cost_usd !== null ? `$${Number(run.estimated_cost_usd).toFixed(2)}` : "\u2014"}
                {" \u00b7 "}
                {run.total_time_s !== null ? `${Math.round(Number(run.total_time_s))}s` : "\u2014"}
              </span>
              <span className="research-date">
                {new Date(run.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="empty-state">No creative runs yet. Run a build with database recording enabled.</p>
        )}
      </div>
    </div>
  );
}
