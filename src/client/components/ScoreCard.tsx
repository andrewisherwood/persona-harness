import "./ScoreCard.css";

interface Props {
  label: string;
  value: number | string;
  max?: number;
  status?: "pass" | "fail" | "running";
}

export function ScoreCard({ label, value, max, status }: Props) {
  return (
    <div className="card score-card">
      <div className="score-label">{label}</div>
      <div className="score-value">
        {value}
        {max !== undefined && <span className="score-max">/{max}</span>}
      </div>
      {status && <span className={`badge badge-${status}`}>{status}</span>}
    </div>
  );
}
