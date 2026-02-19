import { useEffect, useRef, useState } from "react";

export interface SSEMessage {
  event: string;
  data: Record<string, unknown>;
}

export function useSSE(url: string | null) {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    const EVENT_TYPES = ["chatting", "evaluating", "building", "deploying", "complete", "error", "done"];

    const handleEvent = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        if (evt.type === "done") {
          setIsDone(true);
          es.close();
          return;
        }
        setMessages((prev) => [...prev, { event: evt.type, data }]);
      } catch {
        // ignore parse errors
      }
    };

    for (const type of EVENT_TYPES) {
      es.addEventListener(type, handleEvent);
    }

    return () => {
      es.close();
    };
  }, [url]);

  return { messages, isConnected, isDone };
}
