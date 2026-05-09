import https from 'https';

export interface QuotaSnapshot {
  tokensUsedToday: number;
  tokensDailyLimit: number;
  burnRatePerHour: number;
  projectedExhaustionHours: number | null;
  requestsUsedToday: number;
  sessionCount: number;
}

interface TokenBucket {
  timestamps: number[];
  tokens: number[];
}

const _bucket: TokenBucket = { timestamps: [], tokens: [] };

function pruneOlderThan(ms: number) {
  const cutoff = Date.now() - ms;
  while (_bucket.timestamps.length > 0 && _bucket.timestamps[0] < cutoff) {
    _bucket.timestamps.shift();
    _bucket.tokens.shift();
  }
}

export function recordTokenUsage(tokens: number) {
  _bucket.timestamps.push(Date.now());
  _bucket.tokens.push(tokens);
}

function computeBurnRate(): number {
  pruneOlderThan(3600_000);
  if (_bucket.timestamps.length < 2) return 0;
  const totalTokens = _bucket.tokens.reduce((s, t) => s + t, 0);
  const spanMs = Date.now() - _bucket.timestamps[0];
  if (spanMs <= 0) return 0;
  return Math.round((totalTokens / spanMs) * 3600_000);
}

async function fetchAnthropicUsage(apiKey: string): Promise<{ input_tokens: number; output_tokens: number } | null> {
  const today = new Date().toISOString().slice(0, 10);
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: `/v1/usage?date=${today}`,
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.input_tokens !== undefined) {
            resolve({ input_tokens: json.input_tokens ?? 0, output_tokens: json.output_tokens ?? 0 });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

export async function collectQuotaMetrics(): Promise<QuotaSnapshot> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  const burnRate = computeBurnRate();

  if (!apiKey) {
    return {
      tokensUsedToday: 0,
      tokensDailyLimit: 0,
      burnRatePerHour: burnRate,
      projectedExhaustionHours: null,
      requestsUsedToday: 0,
      sessionCount: 0,
    };
  }

  const usage = await fetchAnthropicUsage(apiKey);
  if (!usage) {
    return {
      tokensUsedToday: 0,
      tokensDailyLimit: 0,
      burnRatePerHour: burnRate,
      projectedExhaustionHours: null,
      requestsUsedToday: 0,
      sessionCount: 0,
    };
  }

  const tokensUsedToday = usage.input_tokens + usage.output_tokens;
  const tokensDailyLimit = 1_000_000;
  const remaining = Math.max(0, tokensDailyLimit - tokensUsedToday);
  const projectedExhaustionHours = burnRate > 0 ? Math.round((remaining / burnRate) * 10) / 10 : null;

  return {
    tokensUsedToday,
    tokensDailyLimit,
    burnRatePerHour: burnRate,
    projectedExhaustionHours,
    requestsUsedToday: 0,
    sessionCount: 0,
  };
}
