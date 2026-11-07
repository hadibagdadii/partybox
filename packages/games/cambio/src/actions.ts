import { z } from 'zod';

const id = z.string().min(1).max(64);

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('continue') }),
  z.object({ type: z.literal('draw') }),
  z.object({ type: z.literal('callCambio') }),
  z.object({ type: z.literal('swap'), slotId: id }),
  z.object({ type: z.literal('discard') }),
  z.object({ type: z.literal('peek'), slotId: id }),
  z.object({ type: z.literal('donePeek') }),
  z.object({ type: z.literal('blindSwap'), slotIds: z.tuple([id, id]) }),
  z.object({ type: z.literal('kingSwap'), slotId: id }),
  z.object({ type: z.literal('skipPower') }),
  z.object({
    type: z.literal('snap'),
    slotId: id,
    /** The card the snapper saw in the slot; a stale snap is rejected without penalty. */
    cardId: id,
    /** Required when snapping another player's card while you hold any cards. */
    giveSlotId: id.optional(),
  }),
]);

export type CambioAction = z.infer<typeof actionSchema>;
export type CambioActionType = CambioAction['type'];
