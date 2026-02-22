import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi, postApi } from "../hooks/useApi.js";
import { CostSummaryWidget } from "../components/CostSummaryWidget.js";
import "./RunConfig.css";

interface PersonaSummary { id: string; name: string; background: string }

interface ManifestVariant { description: string; file: string }
interface ManifestEntry { production: string; variants: Record<string, ManifestVariant> }
type Manifest = Record<string, ManifestEntry>;

const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

const OPENAI_MODELS = [
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
  { id: "gpt-5-mini", label: "GPT-5 Mini" },
];

interface PromptConfigState {
  designSystem: string;
  generatePage: string;
  modelProvider: "anthropic" | "openai";
  modelName: string;
  temperature: number;
  maxTokens: string;
  providerApiKey: string;
}

function defaultPromptConfig(manifest: Manifest | null): PromptConfigState {
  return {
    designSystem: manifest?.["design-system"]?.production ?? "v1-structured",
    generatePage: manifest?.["generate-page"]?.production ?? "v1-structured",
    modelProvider: "anthropic",
    modelName: "claude-sonnet-4-5-20250929",
    temperature: 0.7,
    maxTokens: "",
    providerApiKey: "",
  };
}

function PromptConfigPanel({
  config, onChange, manifest, label,
}: {
  config: PromptConfigState;
  onChange: (c: PromptConfigState) => void;
  manifest: Manifest | null;
  label: string;
}) {
  const models = config.modelProvider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;
  const dsEntry = manifest?.["design-system"];
  const gpEntry = manifest?.["generate-page"];

  return (
    <div className="prompt-config-panel">
      {label && <h4 className="prompt-config-label">{label}</h4>}
      <div className="prompt-selects">
        <label>
          <span>Design System:</span>
          <select value={config.designSystem} onChange={(e) => onChange({ ...config, designSystem: e.target.value })}>
            {dsEntry && Object.entries(dsEntry.variants).map(([name]) => (
              <option key={name} value={name}>
                {name}{dsEntry.production === name ? " (LIVE)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Page Prompt:</span>
          <select value={config.generatePage} onChange={(e) => onChange({ ...config, generatePage: e.target.value })}>
            {gpEntry && Object.entries(gpEntry.variants).map(([name]) => (
              <option key={name} value={name}>
                {name}{gpEntry.production === name ? " (LIVE)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="model-config">
        <label>
          <span>Provider:</span>
          <div className="mode-toggle">
            <button
              className={config.modelProvider === "anthropic" ? "btn-primary" : "btn-secondary"}
              onClick={() => onChange({ ...config, modelProvider: "anthropic", modelName: ANTHROPIC_MODELS[0]?.id ?? "claude-sonnet-4-5-20250929" })}
            >Anthropic</button>
            <button
              className={config.modelProvider === "openai" ? "btn-primary" : "btn-secondary"}
              onClick={() => onChange({ ...config, modelProvider: "openai", modelName: OPENAI_MODELS[0]?.id ?? "gpt-5.2" })}
            >OpenAI</button>
          </div>
        </label>
        <label>
          <span>Model:</span>
          <select value={config.modelName} onChange={(e) => onChange({ ...config, modelName: e.target.value })}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label>
          <span>Temperature:</span>
          <input type="range" min={0} max={1} step={0.1} value={config.temperature}
            onChange={(e) => onChange({ ...config, temperature: Number(e.target.value) })} />
          <span className="range-value">{config.temperature.toFixed(1)}</span>
        </label>
        <label>
          <span>Max tokens:</span>
          <input type="number" min={1} max={32768} placeholder="Default"
            value={config.maxTokens} onChange={(e) => onChange({ ...config, maxTokens: e.target.value })} />
        </label>
        {config.modelProvider === "openai" && (
          <label>
            <span>API Key:</span>
            <input type="password" placeholder="sk-..." value={config.providerApiKey}
              onChange={(e) => onChange({ ...config, providerApiKey: e.target.value })} />
          </label>
        )}
      </div>
    </div>
  );
}

export function RunConfig() {
  const navigate = useNavigate();
  const { data: personas, loading: personasLoading } = useApi<PersonaSummary[]>("/personas");
  const { data: manifest } = useApi<Manifest>("/prompts");

  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"full-pipeline" | "build-only">("full-pipeline");
  const [promptConfigA, setPromptConfigA] = useState<PromptConfigState | null>(null);
  const [abEnabled, setAbEnabled] = useState(false);
  const [promptConfigB, setPromptConfigB] = useState<PromptConfigState | null>(null);
  const [maxTurns, setMaxTurns] = useState(60);
  const [skipEvaluation, setSkipEvaluation] = useState(false);
  const [skipBuild, setSkipBuild] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const configA = promptConfigA ?? defaultPromptConfig(manifest);
  const configB = promptConfigB ?? defaultPromptConfig(manifest);

  const togglePersona = (id: string) => {
    const next = new Set(selectedPersonas);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPersonas(next);
  };

  const selectAll = () => {
    if (personas) setSelectedPersonas(new Set(personas.map((p) => p.id)));
  };

  const deselectAll = () => setSelectedPersonas(new Set());

  const buildPromptConfig = (c: PromptConfigState) => ({
    designSystem: c.designSystem,
    generatePage: c.generatePage,
    modelProvider: c.modelProvider,
    modelName: c.modelName,
    temperature: c.temperature,
    maxTokens: c.maxTokens ? Number(c.maxTokens) : undefined,
    providerApiKey: c.providerApiKey || undefined,
  });

  const startRun = async () => {
    setIsStarting(true);
    try {
      const result = await postApi<{ runId: string }>("/runs", {
        mode,
        personas: [...selectedPersonas],
        promptConfig: buildPromptConfig(configA),
        promptConfigB: abEnabled ? buildPromptConfig(configB) : undefined,
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

      <CostSummaryWidget />

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
        <h3>Build Prompts</h3>
        <PromptConfigPanel config={configA} onChange={setPromptConfigA} manifest={manifest} label="" />
        <label className="ab-toggle">
          <input type="checkbox" checked={abEnabled} onChange={(e) => setAbEnabled(e.target.checked)} />
          Enable A/B Mode
        </label>
        {abEnabled && (
          <PromptConfigPanel config={configB} onChange={setPromptConfigB} manifest={manifest} label="Variant B" />
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
