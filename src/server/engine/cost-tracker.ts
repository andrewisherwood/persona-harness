export const MODEL_RATES: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "claude-sonnet-4-5-20250929": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus-4-5-20250514": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.80, outputPerMillion: 4 },
};

interface DirectCallRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface EstimatedCallRecord {
  messageCount: number;
  estimatedTokens: number;
  model: string;
}

export interface DirectSummary {
  input_tokens: number;
  output_tokens: number;
  model: string;
  usd: number;
}

export interface EstimatedSummary {
  messages: number;
  estimated_tokens: number;
  usd_estimate: number;
}

export interface CostSummary {
  [category: string]: DirectSummary | EstimatedSummary | number | undefined;
  persona_agent?: DirectSummary;
  judge?: DirectSummary;
  chatbot_estimated?: EstimatedSummary;
  build_estimated?: EstimatedSummary;
  total_usd: number;
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_RATES[model];
  if (!rates) return 0;
  return (inputTokens / 1_000_000) * rates.inputPerMillion +
         (outputTokens / 1_000_000) * rates.outputPerMillion;
}

export class CostTracker {
  private directCalls = new Map<string, { model: string; inputTokens: number; outputTokens: number }>();
  private estimatedCalls = new Map<string, EstimatedCallRecord>();

  recordDirectCall(category: string, record: DirectCallRecord): void {
    const existing = this.directCalls.get(category);
    if (existing) {
      existing.inputTokens += record.inputTokens;
      existing.outputTokens += record.outputTokens;
    } else {
      this.directCalls.set(category, { ...record });
    }
  }

  recordEstimatedCall(category: string, record: EstimatedCallRecord): void {
    const existing = this.estimatedCalls.get(category);
    if (existing) {
      existing.messageCount += record.messageCount;
      existing.estimatedTokens += record.estimatedTokens;
    } else {
      this.estimatedCalls.set(category, { ...record });
    }
  }

  getSummary(): CostSummary {
    const summary: CostSummary = { total_usd: 0 };

    for (const [category, record] of this.directCalls) {
      const usd = calculateCost(record.model, record.inputTokens, record.outputTokens);
      const entry: DirectSummary = {
        input_tokens: record.inputTokens,
        output_tokens: record.outputTokens,
        model: record.model,
        usd,
      };
      summary[category] = entry;
      summary.total_usd += usd;
    }

    for (const [category, record] of this.estimatedCalls) {
      const rates = MODEL_RATES[record.model];
      const usdEstimate = rates
        ? (record.estimatedTokens / 1_000_000) * ((rates.inputPerMillion + rates.outputPerMillion) / 2)
        : 0;
      const entry: EstimatedSummary = {
        messages: record.messageCount,
        estimated_tokens: record.estimatedTokens,
        usd_estimate: usdEstimate,
      };
      summary[category] = entry;
      summary.total_usd += usdEstimate;
    }

    summary.total_usd = Math.round(summary.total_usd * 10000) / 10000;
    return summary;
  }
}
