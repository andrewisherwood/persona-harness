import { useParams, Link } from "react-router-dom";
import { useSSE } from "../hooks/useSSE.js";
import { ChatBubble } from "../components/ChatBubble.js";
import { useEffect, useRef } from "react";
import "./RunProgress.css";

const STEPS = ["chatting", "evaluating", "building", "deploying", "complete"];

export function RunProgress() {
  const { runId } = useParams<{ runId: string }>();
  const { messages, isDone } = useSSE(runId ? `/api/runs/${runId}/stream` : null);
  const feedRef = useRef<HTMLDivElement>(null);

  // Extract chat messages
  const chatMessages = messages
    .filter((m) => m.data.message)
    .map((m) => ({
      persona: m.data.persona as string,
      turn: m.data.turn as number,
      role: (m.data.message as Record<string, unknown>).role as string,
      content: (m.data.message as Record<string, unknown>).content as string,
    }));

  // Current step from latest message
  const latestStep = messages.length > 0
    ? (messages[messages.length - 1]!.data.step as string) ?? "pending"
    : "pending";

  // Current persona from latest message
  const currentPersona = messages.length > 0
    ? (messages[messages.length - 1]!.data.persona as string) ?? ""
    : "";

  // Auto-scroll
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages.length]);

  return (
    <div className="run-progress">
      <div className="progress-header">
        <h2>Run Progress</h2>
        <div className="progress-meta">
          {currentPersona && <span className="badge badge-running">{currentPersona}</span>}
          <span className={`badge badge-${isDone ? "pass" : "running"}`}>
            {isDone ? "Complete" : latestStep}
          </span>
          {!isDone && <span className="pulse-dot" />}
        </div>
      </div>

      <div className="step-indicator">
        {STEPS.map((step) => {
          const stepIdx = STEPS.indexOf(step);
          const currentIdx = STEPS.indexOf(latestStep);
          let state = "pending";
          if (stepIdx < currentIdx || isDone) state = "done";
          else if (stepIdx === currentIdx) state = "active";
          return (
            <div key={step} className={`step ${state}`}>
              <div className="step-dot" />
              <span className="step-label">{step}</span>
            </div>
          );
        })}
      </div>

      <div className="conversation-feed card" ref={feedRef}>
        {chatMessages.length === 0 && !isDone && (
          <p className="feed-waiting">Waiting for conversation to start...</p>
        )}
        {chatMessages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role as "user" | "assistant"} content={msg.content} turn={msg.turn} />
        ))}
      </div>

      {isDone && (
        <div className="progress-actions">
          <Link to={`/results/${runId}`} className="btn-primary" style={{ textDecoration: "none", padding: "var(--space-2) var(--space-6)" }}>
            View Results
          </Link>
        </div>
      )}
    </div>
  );
}
