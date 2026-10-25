import { z } from 'zod';

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{4}$/, 'Room code must be 4 letters');

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  name: z.string().trim().min(1).max(20),
});
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

export interface ErrorPayload {
  code: 'invalid_payload' | 'room_not_found' | 'wrong_phase' | 'not_your_turn';
  message: string;
}

export interface ClientToServerEvents {
  ping: (ack: (reply: { ok: true; at: number }) => void) => void;
}

export interface ServerToClientEvents {
  error: (payload: ErrorPayload) => void;
}
