import { z } from 'zod';
import { SCORING_MODES } from './ids.js';

export const MATCH_TARGET_MIN = 10;
export const MATCH_TARGET_MAX = 500;

/** Host options. Missing fields take their defaults. */
export const optionsSchema = z.object({
  scoringMode: z.enum(SCORING_MODES).default('single'),
  matchTarget: z.number().int().min(MATCH_TARGET_MIN).max(MATCH_TARGET_MAX).default(100),
  lockCaller: z.boolean().default(true),
  rememberPeeks: z.boolean().default(false),
});

export type CambioOptions = z.output<typeof optionsSchema>;

export const defaultOptions: CambioOptions = optionsSchema.parse({});
