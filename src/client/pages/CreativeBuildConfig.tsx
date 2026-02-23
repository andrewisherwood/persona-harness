import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postApi } from "../hooks/useApi.js";
import "./CreativeBuildConfig.css";

interface ModelOption {
  id: string;
  label: string;
  costHint: string;
  provider: "anthropic" | "openai";
}

const MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5", costHint: "~$0.30", provider: "anthropic" },
  { id: "claude-opus-4-6", label: "Opus 4.6", costHint: "~$6.50", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", costHint: "~$0.05", provider: "anthropic" },
  { id: "gpt-5.2", label: "GPT-5.2", costHint: "~$0.25", provider: "openai" },
  { id: "gpt-5.2-pro", label: "GPT-5.2 Pro", costHint: "~$0.50", provider: "openai" },
  { id: "gpt-5-mini", label: "GPT-5 Mini", costHint: "~$0.03", provider: "openai" },
];

const PALETTE_OPTIONS = [
  { id: "sage_sand", label: "Sage & Sand", colours: ["#f5f0e8", "#5f7161", "#c9b99a", "#3d3d3d"] },
  { id: "blush_neutral", label: "Blush Neutral", colours: ["#fdf6f0", "#c9928e", "#d4c5b9", "#4a4a4a"] },
  { id: "deep_earth", label: "Deep Earth", colours: ["#f0ebe3", "#6b4c3b", "#a08060", "#2d2d2d"] },
  { id: "ocean_calm", label: "Ocean Calm", colours: ["#f0f4f5", "#3d6b7e", "#8fb8c9", "#2d3b3e"] },
];

const TYPOGRAPHY_OPTIONS = [
  { id: "modern", label: "Modern", desc: "Inter / Inter" },
  { id: "classic", label: "Classic", desc: "Playfair Display / Source Sans 3" },
  { id: "mixed", label: "Mixed", desc: "DM Serif Display / Inter" },
];

export function CreativeBuildConfig() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<"anthropic" | "openai">("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [palette, setPalette] = useState("sage_sand");
  const [typography, setTypography] = useState("mixed");
  const [style, setStyle] = useState("classic");
  const [feeling, setFeeling] = useState("Reassuring");
  const [temperature, setTemperature] = useState(0.7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleModels = MODELS.filter((m) => m.provider === provider);
  const selectedModel = MODELS.find((m) => m.id === model);

  const handleProviderChange = (p: "anthropic" | "openai") => {
    setProvider(p);
    const firstModel = MODELS.find((m) => m.provider === p);
    if (firstModel) setModel(firstModel.id);
  };

  const handleStart = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await postApi<{ trackingId: string }>("/research/runs", {
        model,
        temperature,
        palette,
        typography,
        style,
        feeling,
      });
      navigate(`/research/run/${result.trackingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="creative-config">
      <h2>New Creative Build</h2>
      <p className="creative-config-subtitle">
        Generate a website with full creative freedom — no edge function constraints
      </p>

      {/* Model selection */}
      <div className="config-section card">
        <h3>Model</h3>
        <div className="provider-toggle">
          <button
            className={`provider-btn ${provider === "anthropic" ? "active" : ""}`}
            onClick={() => handleProviderChange("anthropic")}
          >
            Anthropic
          </button>
          <button
            className={`provider-btn ${provider === "openai" ? "active" : ""}`}
            onClick={() => handleProviderChange("openai")}
          >
            OpenAI
          </button>
        </div>
        <div className="model-grid">
          {visibleModels.map((m) => (
            <button
              key={m.id}
              className={`model-option ${model === m.id ? "selected" : ""}`}
              onClick={() => setModel(m.id)}
            >
              <span className="model-option-label">{m.label}</span>
              <span className="model-option-cost">{m.costHint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Palette selection */}
      <div className="config-section card">
        <h3>Palette</h3>
        <div className="palette-grid">
          {PALETTE_OPTIONS.map((p) => (
            <button
              key={p.id}
              className={`palette-option ${palette === p.id ? "selected" : ""}`}
              onClick={() => setPalette(p.id)}
            >
              <div className="palette-swatches">
                {p.colours.map((c, i) => (
                  <span key={i} className="swatch" style={{ background: c }} />
                ))}
              </div>
              <span className="palette-label">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Typography selection */}
      <div className="config-section card">
        <h3>Typography</h3>
        <div className="typo-grid">
          {TYPOGRAPHY_OPTIONS.map((t) => (
            <button
              key={t.id}
              className={`typo-option ${typography === t.id ? "selected" : ""}`}
              onClick={() => setTypography(t.id)}
            >
              <span className="typo-option-label">{t.label}</span>
              <span className="typo-option-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Style + feeling */}
      <div className="config-section card">
        <h3>Brand</h3>
        <div className="brand-fields">
          <label>
            <span>Style</span>
            <input type="text" value={style} onChange={(e) => setStyle(e.target.value)} />
          </label>
          <label>
            <span>Brand feeling</span>
            <input type="text" value={feeling} onChange={(e) => setFeeling(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Temperature */}
      <div className="config-section card">
        <h3>Temperature</h3>
        <div className="temp-control">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
          <span className="range-value">{temperature.toFixed(2)}</span>
        </div>
      </div>

      {/* Cost estimate + start */}
      <div className="creative-config-actions">
        <div className="cost-estimate">
          Estimated cost: <strong>{selectedModel?.costHint ?? "—"}</strong>
        </div>
        {error && <p className="creative-config-error">{error}</p>}
        <button
          className="btn-primary start-btn"
          onClick={handleStart}
          disabled={submitting}
        >
          {submitting ? "Starting..." : "Start Build"}
        </button>
      </div>
    </div>
  );
}
