import { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { ScoreCard } from "../components/ScoreCard.js";
import { ChatBubble } from "../components/ChatBubble.js";
import "./ABCompare.css";

interface RunEntry { id: string; config: any; summary: any }

export function ABCompare() {
  const { data: runs } = useApi<RunEntry[]>("/runs");
  const [runIdA, setRunIdA] = useState("");
  const [runIdB, setRunIdB] = useState("");
  const { data: runA } = useApi<any>(runIdA ? `/runs/${runIdA}` : null);
  const { data: runB } = useApi<any>(runIdB ? `/runs/${runIdB}` : null);

  // Get first persona from each run for comparison
  const personaIdA = runA ? Object.keys(runA.personas ?? {})[0] : null;
  const personaIdB = runB ? Object.keys(runB.personas ?? {})[0] : null;
  const pA = personaIdA ? runA?.personas[personaIdA] : null;
  const pB = personaIdB ? runB?.personas[personaIdB] : null;

  return (
    <div className="ab-compare">
      <h2>A/B Comparison</h2>

      <div className="ab-selectors card">
        <div className="ab-select">
          <label>Run A:</label>
          <select value={runIdA} onChange={(e) => setRunIdA(e.target.value)}>
            <option value="">Select a run</option>
            {runs?.map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
          </select>
        </div>
        <div className="ab-vs">vs</div>
        <div className="ab-select">
          <label>Run B:</label>
          <select value={runIdB} onChange={(e) => setRunIdB(e.target.value)}>
            <option value="">Select a run</option>
            {runs?.filter((r) => r.id !== runIdA).map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
          </select>
        </div>
      </div>

      {pA && pB && (
        <div className="ab-grid">
          <div className="ab-column">
            <h3>Run A: {runIdA}</h3>
            <div className="ab-scores">
              <ScoreCard label="Quality" value={pA.evaluation?.overall_score ?? "—"} max={5} status={pA.evaluation?.hard_fails?.length === 0 ? "pass" : "fail"} />
              <ScoreCard label="Turns" value={pA.conversation?.length ?? 0} />
            </div>
            {pA.previewUrl && <a href={pA.previewUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary preview-btn">Preview A ↗</a>}
            <div className="ab-conversation">
              {pA.conversation?.slice(0, 20).map((msg: any, i: number) => (
                <ChatBubble key={i} role={msg.role} content={msg.content} turn={msg.turn} />
              ))}
              {(pA.conversation?.length ?? 0) > 20 && <p className="truncated">...{pA.conversation.length - 20} more turns</p>}
            </div>
          </div>

          <div className="ab-divider" />

          <div className="ab-column">
            <h3>Run B: {runIdB}</h3>
            <div className="ab-scores">
              <ScoreCard label="Quality" value={pB.evaluation?.overall_score ?? "—"} max={5} status={pB.evaluation?.hard_fails?.length === 0 ? "pass" : "fail"} />
              <ScoreCard label="Turns" value={pB.conversation?.length ?? 0} />
            </div>
            {pB.previewUrl && <a href={pB.previewUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary preview-btn">Preview B ↗</a>}
            <div className="ab-conversation">
              {pB.conversation?.slice(0, 20).map((msg: any, i: number) => (
                <ChatBubble key={i} role={msg.role} content={msg.content} turn={msg.turn} />
              ))}
              {(pB.conversation?.length ?? 0) > 20 && <p className="truncated">...{pB.conversation.length - 20} more turns</p>}
            </div>
          </div>
        </div>
      )}

      {(!pA || !pB) && runIdA && runIdB && <p className="loading">Loading comparison...</p>}
    </div>
  );
}
