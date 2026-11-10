/** Every provider failure is mapped onto one of these, so the pipeline reacts to the outcome, not the vendor. */
export type Outcome = 'retry_later' | 'content_blocked' | 'out_of_quota' | 'invalid_input' | 'provider_down' | 'not_configured';

export class ProviderError extends Error {
  constructor(public provider: string, public outcome: Outcome, message: string, public status?: number) {
    super(`[${provider}] ${outcome}: ${message}`);
  }
}

export function outcomeFromStatus(status: number, body = ''): Outcome {
  if (status === 429) return /quota|credit|balance|billing/i.test(body) ? 'out_of_quota' : 'retry_later';
  if (status === 402) return 'out_of_quota';
  if (status === 401 || status === 403) return 'not_configured';
  if (status === 400 || status === 404 || status === 422) return /safety|moderation|policy|blocked/i.test(body) ? 'content_blocked' : 'invalid_input';
  if (status >= 500) return 'provider_down';
  return 'invalid_input';
}

export function requireKey(provider: string, name: string): string {
  const v = process.env[name];
  if (!v) throw new ProviderError(provider, 'not_configured', `Missing environment variable ${name}. See docs/env.md.`);
  return v;
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      const o = e instanceof ProviderError ? e.outcome : 'provider_down';
      if (o !== 'retry_later' && o !== 'provider_down') throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw last;
}
