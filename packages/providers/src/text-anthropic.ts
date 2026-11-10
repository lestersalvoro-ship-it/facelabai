import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ProviderError, outcomeFromStatus, requireKey } from './errors.ts';
import { PRICING } from './pricing.ts';

export type TextModel = keyof typeof PRICING.text;

/** Ask Claude for JSON matching a schema. The schema is enforced twice: by the tool definition and by Zod. */
export async function generateStructured<S extends z.ZodTypeAny>(opts: {
  schema: S; system: string; prompt: string; model?: TextModel; maxTokens?: number;
}): Promise<{ value: z.infer<S>; usd: number; model: string }> {
  const model = opts.model ?? 'claude-sonnet-5-5';
  const client = new Anthropic({ apiKey: requireKey('anthropic', 'ANTHROPIC_API_KEY') });
  try {
    const res = await client.messages.create({
      model, max_tokens: opts.maxTokens ?? 8000, system: opts.system,
      tools: [{ name: 'submit', description: 'Submit the result.', input_schema: zodToJsonSchema(opts.schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Anthropic.Tool.InputSchema }],
      tool_choice: { type: 'tool', name: 'submit' },
      messages: [{ role: 'user', content: opts.prompt }],
    });
    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') throw new ProviderError('anthropic', 'invalid_input', 'Model returned no structured output.');
    const parsed = opts.schema.safeParse(block.input);
    if (!parsed.success) throw new ProviderError('anthropic', 'invalid_input', `Output failed validation: ${parsed.error.message.slice(0, 400)}`);
    const p = PRICING.text[model];
    const usd = (res.usage.input_tokens * p.inPerMTok + res.usage.output_tokens * p.outPerMTok) / 1e6;
    return { value: parsed.data, usd, model };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Anthropic.APIError) throw new ProviderError('anthropic', outcomeFromStatus(e.status ?? 500, e.message), e.message, e.status);
    throw new ProviderError('anthropic', 'provider_down', String(e));
  }
}
