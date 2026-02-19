import "./CostBreakdown.css";

interface CostEntry {
  usd?: number;
  usd_estimate?: number;
}

interface Props {
  cost: Record<string, CostEntry | number>;
}

export function CostBreakdown({ cost }: Props) {
  const rows = Object.entries(cost).filter(([k]) => k !== "total_usd");
  const totalUsd = typeof cost["total_usd"] === "number" ? cost["total_usd"] : 0;

  return (
    <div className="card">
      <h4>Cost Breakdown</h4>
      <table className="cost-table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, val]) => {
            const entry = val as CostEntry;
            const amount = entry.usd ?? entry.usd_estimate ?? 0;
            return (
              <tr key={key}>
                <td>{key.replace(/_/g, " ")}</td>
                <td className="text-right">${amount.toFixed(4)}</td>
              </tr>
            );
          })}
          <tr className="cost-total">
            <td>Total</td>
            <td className="text-right">${totalUsd.toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
