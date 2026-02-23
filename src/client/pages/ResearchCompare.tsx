import { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import "./ResearchCompare.css";

interface RunSummary {
  id: string;
  model_name: string;
  palette: string;
  typography: string;
  style: string;
  brand_feeling: string;
  estimated_cost_usd: number | null;
  total_time_s: number | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  preview_url: string | null;
  status: string;
}

interface RunDetail {
  run: RunSummary;
  pages: Array<{
    page_name: string;
    img_count: number | null;
    heading_count: number | null;
    landmark_count: number | null;
    link_count: number | null;
    schema_org_present: boolean | null;
    input_tokens: number | null;
    output_tokens: number | null;
    generation_time_s: number | null;
  }>;
}

export function ResearchCompare() {
  const { data: runs } = useApi<RunSummary[]>("/research");
  const [runIdA, setRunIdA] = useState("");
  const [runIdB, setRunIdB] = useState("");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);

  const { data: detailA } = useApi<RunDetail>(runIdA ? `/research/${runIdA}` : "");
  const { data: detailB } = useApi<RunDetail>(runIdB ? `/research/${runIdB}` : "");

  const completeRuns = (runs ?? []).filter((r) => r.status === "complete");

  const pagesA = detailA?.pages.filter((p) => p.page_name !== "design_system") ?? [];
  const pagesB = detailB?.pages.filter((p) => p.page_name !== "design_system") ?? [];
  const allPageNames = [...new Set([...pagesA.map((p) => p.page_name), ...pagesB.map((p) => p.page_name)])];
  const activePage = selectedPage ?? allPageNames[0] ?? null;

  const pageA = pagesA.find((p) => p.page_name === activePage);
  const pageB = pagesB.find((p) => p.page_name === activePage);

  const runLabel = (r: RunSummary) =>
    `${r.model_name} — ${r.palette} / ${r.style}`;

  return (
    <div className="research-compare">
      <h2>Compare Creative Runs</h2>

      <div className="compare-selectors card">
        <div className="compare-select">
          <label>Run A</label>
          <select value={runIdA} onChange={(e) => setRunIdA(e.target.value)}>
            <option value="">Select a run</option>
            {completeRuns.map((r) => (
              <option key={r.id} value={r.id}>{runLabel(r)}</option>
            ))}
          </select>
        </div>
        <span className="compare-vs">vs</span>
        <div className="compare-select">
          <label>Run B</label>
          <select value={runIdB} onChange={(e) => setRunIdB(e.target.value)}>
            <option value="">Select a run</option>
            {completeRuns
              .filter((r) => r.id !== runIdA)
              .map((r) => (
                <option key={r.id} value={r.id}>{runLabel(r)}</option>
              ))}
          </select>
        </div>
      </div>

      {detailA && detailB && (
        <>
          <div className="compare-grid">
            <RunColumn run={detailA.run} label="A" />
            <div className="compare-divider" />
            <RunColumn run={detailB.run} label="B" />
          </div>

          {allPageNames.length > 0 && (
            <>
              <div className="compare-page-tabs">
                {allPageNames.map((name) => (
                  <button
                    key={name}
                    className={`compare-page-tab ${activePage === name ? "active" : ""}`}
                    onClick={() => setSelectedPage(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>

              <div className="compare-grid">
                <div className="compare-column">
                  {detailA.run.preview_url && (
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                      <iframe
                        src={activePage === "home" ? detailA.run.preview_url : `${detailA.run.preview_url}/${activePage}.html`}
                        title={`A: ${activePage}`}
                        className="compare-frame"
                      />
                    </div>
                  )}
                  {pageA && <MetricsTable page={pageA} other={pageB} />}
                </div>
                <div className="compare-divider" />
                <div className="compare-column">
                  {detailB.run.preview_url && (
                    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                      <iframe
                        src={activePage === "home" ? detailB.run.preview_url : `${detailB.run.preview_url}/${activePage}.html`}
                        title={`B: ${activePage}`}
                        className="compare-frame"
                      />
                    </div>
                  )}
                  {pageB && <MetricsTable page={pageB} other={pageA} />}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {runIdA && runIdB && (!detailA || !detailB) && (
        <p className="loading">Loading comparison...</p>
      )}
    </div>
  );
}

function RunColumn({ run, label }: { run: RunSummary; label: string }) {
  return (
    <div className="compare-column">
      <div className="card">
        <div className="compare-model-header">
          <h3>Run {label}: {run.model_name}</h3>
          <div className="compare-vars">
            <span className="var-pill">{run.palette}</span>
            <span className="var-pill">{run.style}</span>
            <span className="var-pill">{run.typography}</span>
            <span className="var-pill">{run.brand_feeling}</span>
          </div>
        </div>
        <div className="compare-stats">
          <div className="compare-stat">
            <span className="compare-stat-label">Cost</span>
            <span className="compare-stat-value">
              {run.estimated_cost_usd !== null ? `$${Number(run.estimated_cost_usd).toFixed(2)}` : "\u2014"}
            </span>
          </div>
          <div className="compare-stat">
            <span className="compare-stat-label">Time</span>
            <span className="compare-stat-value">
              {run.total_time_s !== null ? `${Math.round(Number(run.total_time_s))}s` : "\u2014"}
            </span>
          </div>
          <div className="compare-stat">
            <span className="compare-stat-label">Input tokens</span>
            <span className="compare-stat-value">
              {run.total_input_tokens !== null ? `${(run.total_input_tokens / 1000).toFixed(0)}K` : "\u2014"}
            </span>
          </div>
          <div className="compare-stat">
            <span className="compare-stat-label">Output tokens</span>
            <span className="compare-stat-value">
              {run.total_output_tokens !== null ? `${(run.total_output_tokens / 1000).toFixed(0)}K` : "\u2014"}
            </span>
          </div>
        </div>
        {run.preview_url && (
          <a href={run.preview_url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ marginTop: "var(--space-3)", display: "inline-block", textAlign: "center", textDecoration: "none" }}>
            View Site &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

interface PageData {
  page_name: string;
  img_count: number | null;
  heading_count: number | null;
  landmark_count: number | null;
  link_count: number | null;
  schema_org_present: boolean | null;
  input_tokens: number | null;
  output_tokens: number | null;
  generation_time_s: number | null;
}

function MetricsTable({ page, other }: { page: PageData; other?: PageData }) {
  const compare = (a: number | null, b: number | null, higherBetter: boolean) => {
    if (a === null || b === null) return "";
    if (a === b) return "";
    return (a > b) === higherBetter ? "metric-better" : "metric-worse";
  };

  return (
    <div className="card compare-metrics">
      <table>
        <tbody>
          <tr>
            <td>Images</td>
            <td className={compare(page.img_count, other?.img_count ?? null, true)}>
              {page.img_count ?? "\u2014"}
            </td>
          </tr>
          <tr>
            <td>Headings</td>
            <td className={compare(page.heading_count, other?.heading_count ?? null, true)}>
              {page.heading_count ?? "\u2014"}
            </td>
          </tr>
          <tr>
            <td>Landmarks</td>
            <td className={compare(page.landmark_count, other?.landmark_count ?? null, true)}>
              {page.landmark_count ?? "\u2014"}
            </td>
          </tr>
          <tr>
            <td>Links</td>
            <td>{page.link_count ?? "\u2014"}</td>
          </tr>
          <tr>
            <td>Schema.org</td>
            <td>{page.schema_org_present === null ? "\u2014" : page.schema_org_present ? "Yes" : "No"}</td>
          </tr>
          <tr>
            <td>Generation time</td>
            <td className={compare(page.generation_time_s, other?.generation_time_s ?? null, false)}>
              {page.generation_time_s ? `${page.generation_time_s}s` : "\u2014"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
