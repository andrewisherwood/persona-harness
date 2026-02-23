import { useParams, Link } from "react-router-dom";
import { useSSE } from "../hooks/useSSE.js";
import "./CreativeBuildProgress.css";

const PAGE_STEPS = ["design-system", "home", "about", "services", "contact", "testimonials", "faq", "deploying"];

function stepLabel(step: string): string {
  if (step === "design-system") return "Design System";
  if (step === "deploying") return "Deploy";
  return step.charAt(0).toUpperCase() + step.slice(1);
}

export function CreativeBuildProgress() {
  const { id } = useParams<{ id: string }>();
  const { messages, isDone, error, doneData } = useSSE(
    id ? `/api/research/runs/${id}/stream` : null,
    ["progress"],
  );

  // Determine which step is current from the latest progress message
  const latest = messages.length > 0 ? messages[messages.length - 1]!.data : null;
  const currentStep = latest?.step as string | undefined;
  const currentPage = latest?.pageName as string | undefined;

  // Build the active step key
  const activeKey = currentStep === "page" ? currentPage : currentStep;

  // dbRunId comes from the done event
  const dbRunId = (doneData?.dbRunId as string) ?? null;

  return (
    <div className="creative-progress">
      <div className="progress-header">
        <h2>Creative Build</h2>
        <div className="progress-meta">
          <span className={`badge badge-${error ? "fail" : isDone ? "pass" : "running"}`}>
            {error ? "Error" : isDone ? "Complete" : currentStep ?? "Starting"}
          </span>
          {!isDone && <span className="pulse-dot" />}
        </div>
      </div>

      <div className="creative-steps">
        {PAGE_STEPS.map((step) => {
          const stepIdx = PAGE_STEPS.indexOf(step);
          const activeIdx = activeKey ? PAGE_STEPS.indexOf(activeKey) : -1;
          let state = "pending";
          if (isDone && !error) {
            state = "done";
          } else if (stepIdx < activeIdx) {
            state = "done";
          } else if (stepIdx === activeIdx) {
            state = "active";
          }
          return (
            <div key={step} className={`creative-step ${state}`}>
              <div className="creative-step-dot" />
              <span className="creative-step-label">{stepLabel(step)}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="card creative-error">
          <strong>Build failed:</strong> {error}
        </div>
      )}

      <div className="creative-log card">
        {messages.length === 0 && !isDone && (
          <p className="log-waiting">Initialising creative build...</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="log-line">
            <span className="log-step">[{msg.data.step as string}]</span>
            <span className="log-msg">{msg.data.message as string}</span>
          </div>
        ))}
      </div>

      {isDone && !error && (
        <div className="progress-actions">
          {dbRunId ? (
            <Link
              to={`/research/${dbRunId}`}
              className="btn-primary"
              style={{ textDecoration: "none", padding: "var(--space-2) var(--space-6)" }}
            >
              View Results
            </Link>
          ) : (
            <Link
              to="/research"
              className="btn-secondary"
              style={{ textDecoration: "none", padding: "var(--space-2) var(--space-6)" }}
            >
              Back to Research
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
