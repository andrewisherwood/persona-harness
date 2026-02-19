import { useState, useEffect } from "react";
import { useApi, putApi } from "../hooks/useApi.js";
import "./Settings.css";

interface Config {
  dailyBudget: number;
  defaultPersonaModel: string;
  defaultJudgeModel: string;
}

export function Settings() {
  const { data: config, loading } = useApi<Config>("/config");
  const [budget, setBudget] = useState(10);
  const [personaModel, setPersonaModel] = useState("claude-sonnet-4-5-20250929");
  const [judgeModel, setJudgeModel] = useState("claude-sonnet-4-5-20250929");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setBudget(config.dailyBudget);
      setPersonaModel(config.defaultPersonaModel);
      setJudgeModel(config.defaultJudgeModel);
    }
  }, [config]);

  const save = async () => {
    await putApi("/config", { dailyBudget: budget, defaultPersonaModel: personaModel, defaultJudgeModel: judgeModel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  const MODEL_OPTIONS = [
    "claude-sonnet-4-5-20250929",
    "claude-opus-4-5-20250514",
    "claude-haiku-4-5-20251001",
  ];

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <section className="card settings-section">
        <h3>Budget</h3>
        <label className="setting-row">
          <span>Daily budget (USD)</span>
          <input type="number" min={0} step={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        </label>
      </section>

      <section className="card settings-section">
        <h3>Default Models</h3>
        <label className="setting-row">
          <span>Persona agent model</span>
          <select value={personaModel} onChange={(e) => setPersonaModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="setting-row">
          <span>Judge model</span>
          <select value={judgeModel} onChange={(e) => setJudgeModel(e.target.value)}>
            {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </section>

      <button className="btn-primary" onClick={save}>
        {saved ? "Saved ✓" : "Save Settings"}
      </button>
    </div>
  );
}
