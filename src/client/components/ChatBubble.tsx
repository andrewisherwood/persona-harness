import "./ChatBubble.css";

interface Props {
  role: "user" | "assistant";
  content: string;
  turn?: number;
}

export function ChatBubble({ role, content, turn }: Props) {
  return (
    <div className={`chat-bubble ${role}`}>
      <div className="bubble-header">
        <span className="bubble-role">{role === "user" ? "Persona" : "Chatbot"}</span>
        {turn !== undefined && <span className="bubble-turn">#{turn}</span>}
      </div>
      <div className="bubble-content">{content}</div>
    </div>
  );
}
