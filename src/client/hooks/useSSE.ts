import { useEffect, useRef, useState } from "react";

export interface SSEMessage {
  event: string;
  data: Record<string, unknown>;
}

const DEFAULT_EVENTS = ["chatting", "evaluating", "building", "deploying", "complete"];

export function useSSE(url: string | null, eventNames?: string[]) {
  const [messages, setMessages] = useState<SSEMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneData, setDoneData] = useState<Record<string, unknown> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const eventsKey = eventNames?.join(",") ?? "";

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

    const progressEvents = eventNames ?? DEFAULT_EVENTS;

    const handleProgress = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data) as Record<string, unknown>;
        setMessages((prev) => [...prev, { event: evt.type, data }]);
      } catch (parseErr) {
        console.warn(`[useSSE] Failed to parse progress event (type=${evt.type}):`, evt.data, parseErr);
      }
    };

    for (const type of progressEvents) {
      es.addEventListener(type, handleProgress);
    }

    // Server-sent "done" event — run finished successfully
    es.addEventListener("done", (evt: Event) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as Record<string, unknown>;
        setDoneData(data);
      } catch (parseErr) {
        console.warn("[useSSE] Failed to parse done event data:", (evt as MessageEvent).data, parseErr);
      }
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
  }, [url, eventsKey]);

  return { messages, isConnected, isDone, error, doneData };
}
