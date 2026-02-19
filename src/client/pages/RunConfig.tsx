import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi, postApi } from "../hooks/useApi.js";
import "./RunConfig.css";

interface PersonaSummary { id: string; name: string; background: string }
interface PromptSummary { id: string; name: string; source: string }

export function RunConfig() {
  const navigate = useNavigate();
  const { data: personas, loading: personasLoading } = useApi<PersonaSummary[]>("/personas");
  const { data: prompts } = useApi<PromptSummary[]>("/prompts");

  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"full-pipeline" | "build-only">("full-pipeline");
  const [promptSource, setPromptSource] = useState("production");
  const [abEnabled, setAbEnabled] = useState(false);
  const [promptSourceB, setPromptSourceB] = useState("");
  const [maxTurns, setMaxTurns] = useState(60);
  const [skipEvaluation, setSkipEvaluation] = useState(false);
  const [skipBuild, setSkipBuild] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const togglePersona = (id: string) => {
    const next = new Set(selectedPersonas);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPersonas(next);
  };

  const selectAll = () => {
    if (personas) setSelectedPersonas(new Set(personas.map((p) => p.id)));
  };

  const deselectAll = () => setSelectedPersonas(new Set());

  const startRun = async () => {
    setIsStarting(true);
    try {
      const result = await postApi<{ runId: string }>("/runs", {
        mode,
        personas: [...selectedPersonas],
        promptSource,
        promptSourceB: abEnabled ? promptSourceB : undefined,
        maxTurns,
        skipEvaluation,
        skipBuild,
      });
      navigate(`/progress/${result.runId}`);
    } catch (e) {
      alert(`Failed to start run: ${e}`);
      setIsStarting(false);
    }
  };

  if (personasLoading) return <div>Loading...</div>;

  return (
    <div className="run-config">
      <h2>Run Configuration</h2>

      <section className="config-section card">
        <h3>Personas</h3>
        <div className="persona-grid">
          {personas?.map((p) => (
            <label key={p.id} className={`persona-card ${selectedPersonas.has(p.id) ? "selected" : ""}`}>
              <input type="checkbox" checked={selectedPersonas.has(p.id)} onChange={() => togglePersona(p.id)} />
              <div>
                <strong>{p.name}</strong>
                <span className="persona-bg">{p.background}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="persona-actions">
          <button className="btn-secondary" onClick={selectAll}>Select All</button>
          <button className="btn-secondary" onClick={deselectAll}>Deselect All</button>
        </div>
      </section>

      <section className="config-section card">
        <h3>Mode</h3>
        <div className="mode-toggle">
          <button className={mode === "full-pipeline" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("full-pipeline")}>Full Pipeline</button>
          <button className={mode === "build-only" ? "btn-primary" : "btn-secondary"} onClick={() => setMode("build-only")}>Build Only</button>
        </div>
        <p className="mode-desc">
          {mode === "full-pipeline"
            ? "Persona \u2192 Chat \u2192 Site Spec \u2192 Build \u2192 Preview URL"
            : "Saved Site Spec \u2192 Build \u2192 Preview URL"}
        </p>
      </section>

      <section className="config-section card">
        <h3>Prompt</h3>
        <select value={promptSource} onChange={(e) => setPromptSource(e.target.value)}>
          {prompts?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="ab-toggle">
          <input type="checkbox" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} />
          Enable A/B Mode
        </label>
        {abEnabled && (
          <div className="ab-prompt-b">
            <span>Prompt B:</span>
            <select value={promptSourceB} onChange={(e) => setPromptSourceB(e.target.value)}>
              <option value="">Select Prompt B</option>
              {prompts?.filter((p) => p.id !== promptSource).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </section>

      <details className="config-section card">
        <summary><h3 style={{ display: "inline" }}>Advanced Settings</h3></summary>
        <div className="advanced-grid">
          <label>
            <span>Max turns:</span>
            <input type="range" min={10} max={120} step={5} value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} />
            <span className="range-value">{maxTurns}</span>
          </label>
          <label>
            <input type="checkbox" checked={skipEvaluation} onChange={(e) => setSkipEvaluation(e.target.checked)} />
            Skip evaluation (save cost)
          </label>
          <label>
            <input type="checkbox" checked={skipBuild} onChange={(e) => setSkipBuild(e.target.checked)} />
            Skip build (stop at site_spec)
          </label>
        </div>
      </details>

      <button className="btn-primary start-btn" disabled={selectedPersonas.size === 0 || isStarting} onClick={startRun}>
        {isStarting ? "Starting..." : `Start Run (${selectedPersonas.size} persona${selectedPersonas.size !== 1 ? "s" : ""})`}
      </button>
    </div>
  );
}
