import { useState } from "react";
import "./JsonViewer.css";

interface Props {
  data: unknown;
  title: string;
  defaultOpen?: boolean;
}

export function JsonViewer({ data, title, defaultOpen = false }: Props) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="card">
      <div
        className="json-viewer-header"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
      >
        <h4>{title}</h4>
        <span className="json-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>
      </div>
      {expanded && (
        <pre className="json-content">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
