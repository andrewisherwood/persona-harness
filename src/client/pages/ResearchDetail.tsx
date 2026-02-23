import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi.js";
import { JsonViewer } from "../components/JsonViewer.js";
import "./ResearchDetail.css";

interface RunDetailResponse {
  run: {
    id: string;
    created_at: string;
    model_provider: string;
    model_name: string;
    model_version: string | null;
    temperature: number;
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
  };
  pages: Array<{
    id: string;
    page_name: string;
    input_tokens: number | null;
    output_tokens: number | null;
    generation_time_s: number | null;
    img_count: number | null;
    heading_count: number | null;
    landmark_count: number | null;
    link_count: number | null;
    schema_org_present: boolean | null;
    screenshot_path: string | null;
    accessibility_tree: Record<string, unknown> | null;
  }>;
}

export function ResearchDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useApi<RunDetailResponse>(`/research/${id}`);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [showAccessibility, setShowAccessibility] = useState(false);

  if (loading) return <div className="loading">Loading run...</div>;
  if (error || !data) return <div className="error-state">Run not found</div>;

  const { run, pages } = data;
  const contentPages = pages.filter((p) => p.page_name !== "design_system");
  const activePage = contentPages.find((p) => p.page_name === selectedPage) ?? contentPages[0];

  return (
    <div className="research-detail">
      <div className="research-detail-header">
        <Link to="/research" className="back-link">&larr; All Runs</Link>
        <h2>{run.model_name}</h2>
        <div className="research-detail-vars">
          <span className="var-pill">{run.palette}</span>
          <span className="var-pill">{run.style}</span>
          <span className="var-pill">{run.typography}</span>
          <span className="var-pill">{run.brand_feeling}</span>
        </div>
      </div>

      <div className="card research-summary">
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Status</span>
            <span className={`badge badge-${run.status === "complete" ? "pass" : "fail"}`}>{run.status}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Cost</span>
            <span className="summary-value">{run.estimated_cost_usd !== null ? `$${Number(run.estimated_cost_usd).toFixed(2)}` : "\u2014"}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Time</span>
            <span className="summary-value">{run.total_time_s !== null ? `${Math.round(Number(run.total_time_s))}s` : "\u2014"}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Tokens</span>
            <span className="summary-value">
              {run.total_input_tokens !== null
                ? `${(run.total_input_tokens / 1000).toFixed(0)}K in / ${((run.total_output_tokens ?? 0) / 1000).toFixed(0)}K out`
                : "\u2014"}
            </span>
          </div>
        </div>
        {run.preview_url && (
          <a href={run.preview_url} target="_blank" rel="noopener noreferrer" className="btn-primary preview-link">
            View Live Site &rarr;
          </a>
        )}
      </div>

      <div className="page-tabs">
        {contentPages.map((p) => (
          <button
            key={p.page_name}
            className={`page-tab ${activePage?.page_name === p.page_name ? "active" : ""}`}
            onClick={() => { setSelectedPage(p.page_name); setShowAccessibility(false); }}
          >
            {p.page_name}
          </button>
        ))}
      </div>

      {activePage && (
        <div className="page-detail">
          {run.preview_url && (
            <div className="preview-frame-container card">
              <iframe
                src={activePage.page_name === "home" ? run.preview_url : `${run.preview_url}/${activePage.page_name}.html`}
                title={`Preview: ${activePage.page_name}`}
                className="preview-frame"
              />
            </div>
          )}

          <div className="card metrics-table">
            <h3>Page Metrics</h3>
            <table>
              <tbody>
                <tr><td>Images</td><td>{activePage.img_count ?? "\u2014"}</td></tr>
                <tr><td>Headings</td><td>{activePage.heading_count ?? "\u2014"}</td></tr>
                <tr><td>Landmarks</td><td>{activePage.landmark_count ?? "\u2014"}</td></tr>
                <tr><td>Links</td><td>{activePage.link_count ?? "\u2014"}</td></tr>
                <tr><td>Schema.org</td><td>{activePage.schema_org_present === null ? "\u2014" : activePage.schema_org_present ? "Yes" : "No"}</td></tr>
                <tr><td>Input tokens</td><td>{activePage.input_tokens?.toLocaleString() ?? "\u2014"}</td></tr>
                <tr><td>Output tokens</td><td>{activePage.output_tokens?.toLocaleString() ?? "\u2014"}</td></tr>
                <tr><td>Generation time</td><td>{activePage.generation_time_s ? `${activePage.generation_time_s}s` : "\u2014"}</td></tr>
              </tbody>
            </table>
          </div>

          {activePage.accessibility_tree && (
            <div className="card">
              <button
                className="toggle-btn"
                onClick={() => setShowAccessibility(!showAccessibility)}
              >
                {showAccessibility ? "Hide" : "Show"} Accessibility Tree
              </button>
              {showAccessibility && (
                <JsonViewer data={activePage.accessibility_tree} title="Accessibility Tree" defaultOpen />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
