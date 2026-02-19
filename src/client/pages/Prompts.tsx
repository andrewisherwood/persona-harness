import { useState } from "react";
import { useApi } from "../hooks/useApi.js";
import "./Prompts.css";

interface PromptEntry { id: string; name: string; source: string }
interface PromptContent { id: string; content: string }

export function Prompts() {
  const { data: prompts } = useApi<PromptEntry[]>("/prompts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: content } = useApi<PromptContent>(selectedId ? `/prompts/${selectedId}` : "");

  return (
    <div className="prompts-page">
      <h2>Prompts</h2>
      <div className="prompts-layout">
        <div className="prompt-list">
          {prompts?.map((p) => (
            <button key={p.id} className={`prompt-item ${selectedId === p.id ? "active" : ""}`} onClick={() => setSelectedId(p.id)}>
              <strong>{p.name}</strong>
              <span className="prompt-source">{p.source}</span>
            </button>
          ))}
        </div>
        <div className="prompt-content card">
          {content ? (
            <>
              <h3>{content.id}</h3>
              <pre className="prompt-text">{content.content}</pre>
            </>
          ) : (
            <p className="empty-state">Select a prompt to view its content.</p>
          )}
        </div>
      </div>
    </div>
  );
}
