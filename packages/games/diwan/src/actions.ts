import { z } from 'zod';
import { VOTE_IDS } from './ids.js';

const targetId = z.string().min(1).max(64);

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('acknowledge') }),
  z.object({ type: z.literal('nominate'), targetId }),
  z.object({ type: z.literal('vote'), vote: z.enum(VOTE_IDS) }),
  z.object({ type: z.literal('ameerDiscard'), index: z.number().int().min(0).max(2) }),
  z.object({ type: z.literal('wazirEnact'), index: z.number().int().min(0).max(1) }),
  z.object({ type: z.literal('proposeVeto') }),
  z.object({ type: z.literal('answerVeto'), accept: z.boolean() }),
  z.object({ type: z.literal('investigate'), targetId }),
  z.object({ type: z.literal('specialElection'), targetId }),
  z.object({ type: z.literal('execution'), targetId }),
  z.object({ type: z.literal('policyPeekDone') }),
]);

export type DiwanAction = z.infer<typeof actionSchema>;
