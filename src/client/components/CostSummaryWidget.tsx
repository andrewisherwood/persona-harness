import { useApi } from "../hooks/useApi.js";
import "./CostSummaryWidget.css";

interface CostSummaryData {
  today: number;
  thisWeek: number;
  total: number;
  budget: number;
  runCount: number;
  todayRunCount: number;
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function CostSummaryWidget() {
  const { data, loading, error } = useApi<CostSummaryData>("/cost/summary");

  if (loading) {
    return <div className="card cost-summary-loading">Loading cost data...</div>;
  }

  if (error || !data) {
    return <div className="card cost-summary-error">Failed to load cost data</div>;
  }

  const budgetUsedPct = data.budget > 0 ? (data.today / data.budget) * 100 : 0;
  const budgetRemaining = Math.max(0, data.budget - data.today);
  const barClass =
    budgetUsedPct >= 90 ? "danger" : budgetUsedPct >= 70 ? "warning" : "";

  return (
    <div className="card cost-summary-widget">
      <div className="cost-stat">
        <span className="cost-stat-label">Spend Today</span>
        <span className="cost-stat-value">{formatUsd(data.today)}</span>
      </div>

      <div className="cost-stat">
        <span className="cost-stat-label">Spend This Week</span>
        <span className="cost-stat-value">{formatUsd(data.thisWeek)}</span>
      </div>

      <div className="cost-stat">
        <span className="cost-stat-label">Total Spend</span>
        <span className="cost-stat-value">{formatUsd(data.total)}</span>
      </div>

      <div className="cost-stat">
        <span className="cost-stat-label">Runs Today</span>
        <span className="cost-stat-value">{data.todayRunCount}</span>
      </div>

      <div className="cost-budget-section">
        <div className="cost-budget-header">
          <span className="cost-budget-label">Budget</span>
          <span className="cost-budget-remaining">
            {formatUsd(budgetRemaining)} remaining of {formatUsd(data.budget)}/day
          </span>
        </div>
        <div className="cost-budget-bar">
          <div
            className={`cost-budget-bar-fill ${barClass}`}
            style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
