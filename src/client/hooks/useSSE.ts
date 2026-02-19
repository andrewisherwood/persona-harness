import { useEffect, useRef, useState } from "react";

export interface SSEMessage {
  event: string;
  data: Record<string, unknown>;
}

export function useSSE(url: string | null) {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);

    // Built-in EventSource onerror — stop reconnecting by closing
    es.onerror = () => {
      setIsConnected(false);
      es.close();
    };

    const PROGRESS_EVENTS = ["chatting", "evaluating", "building", "deploying", "complete"];

    const handleProgress = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        setMessages((prev) => [...prev, { event: evt.type, data }]);
      } catch {
        // ignore parse errors
      }
    };

    for (const type of PROGRESS_EVENTS) {
      es.addEventListener(type, handleProgress);
    }

    // Server-sent "done" event — run finished successfully
    es.addEventListener("done", () => {
      setIsDone(true);
      es.close();
    });

    // Server-sent "error" event — run failed with an error message
    es.addEventListener("error", ((evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        setError((data.error as string) ?? "Unknown error");
      } catch {
        setError("Run failed");
      }
      setIsDone(true);
      es.close();
    }) as EventListener);

    return () => {
      es.close();
    };
  }, [url]);

  return { messages, isConnected, isDone, error };
}
