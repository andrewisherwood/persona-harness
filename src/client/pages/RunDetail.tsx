import { useParams } from "react-router-dom";
import { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { ScoreCard } from "../components/ScoreCard.js";
import { CostBreakdown } from "../components/CostBreakdown.js";
import { JsonViewer } from "../components/JsonViewer.js";
import "./RunDetail.css";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  turn?: number;
}

interface PersonaEvaluation {
  overall_score: number;
  hard_fails?: string[];
}

interface PersonaResult {
  conversation?: ConversationMessage[];
  siteSpec?: Record<string, unknown>;
  evaluation?: PersonaEvaluation;
  cost?: Record<string, { usd?: number; usd_estimate?: number } | number>;
  previewUrl?: string;
  error?: string;
}

interface RunData {
  personas: Record<string, PersonaResult>;
}

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, loading } = useApi<RunData>(`/runs/${runId}`);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  if (loading || !run) return <div className="loading">Loading...</div>;

  const personas = run.personas ?? {};
  const personaIds = Object.keys(personas);
  const active = selectedPersona ?? personaIds[0] ?? null;
  const persona = active != null ? (personas[active] ?? null) : null;

  return (
    <div className="run-detail">
      <h2>Run: {runId}</h2>

      <div className="persona-tabs">
        {personaIds.map((id) => (
          <button
            key={id}
            className={id === active ? "btn-primary" : "btn-secondary"}
            onClick={() => setSelectedPersona(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {persona && (
        <div className="detail-sections">
          {/* Scores row */}
          {persona.evaluation && (
            <div className="scores-row">
              <ScoreCard
                label="Quality"
                value={persona.evaluation.overall_score}
                max={5}
                status={
                  persona.evaluation.hard_fails?.length === 0 ? "pass" : "fail"
                }
              />
              <ScoreCard
                label="Turns"
                value={persona.conversation?.length ?? 0}
              />
              {persona.previewUrl && (
                <div className="card score-card">
                  <div className="score-label">Preview</div>
                  <a
                    href={persona.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="preview-link"
                  >
                    Open Site &#8599;
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Cost */}
          {persona.cost != null ? (
            <CostBreakdown cost={persona.cost} />
          ) : null}

          {/* Conversation */}
          <div className="card conversation-section">
            <h4>
              Conversation ({persona.conversation?.length ?? 0} turns)
            </h4>
            <div className="conversation-scroll">
              {persona.conversation?.map((msg, i) => (
                <ChatBubble
                  key={i}
                  role={msg.role}
                  content={msg.content}
                  turn={msg.turn}
                />
              ))}
            </div>
          </div>

          {/* Site Spec */}
          {persona.siteSpec && (
            <JsonViewer data={persona.siteSpec} title="Site Spec" />
          )}

          {/* Evaluation */}
          {persona.evaluation && (
            <JsonViewer data={persona.evaluation} title="Evaluation" />
          )}

          {/* Error */}
          {persona.error && (
            <div
              className="card"
              style={{ borderColor: "var(--color-fail)" }}
            >
              <h4 style={{ color: "var(--color-fail)" }}>Error</h4>
              <pre className="json-content">{persona.error}</pre>
            </div>
          )}
        </div>
      )}

      {personaIds.length === 0 && (
        <p className="empty-state">No persona results in this run.</p>
      )}
    </div>
  );
}
