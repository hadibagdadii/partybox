import type { Room } from './room.js';

export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;

/** Where rooms live. Kept behind an interface so Redis can replace the Map later. */
export interface RoomStore {
  get(code: string): Room | undefined;
  has(code: string): boolean;
  /** Saves the room and marks it active now. */
  save(room: Room): void;
  delete(code: string): void;
  /** Removes rooms idle longer than the TTL and returns their codes. */
  sweepIdle(): string[];
}

export class MemoryRoomStore implements RoomStore {
  private readonly rooms = new Map<string, { room: Room; lastActiveAt: number }>();

  constructor(
    private readonly ttlMs = ROOM_IDLE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  get(code: string): Room | undefined {
    return this.rooms.get(code)?.room;
  }

  has(code: string): boolean {
    return this.rooms.has(code);
  }

  save(room: Room): void {
    this.rooms.set(room.code, { room, lastActiveAt: this.now() });
  }

  delete(code: string): void {
    this.rooms.delete(code);
  }

  sweepIdle(): string[] {
    const cutoff = this.now() - this.ttlMs;
    const removed: string[] = [];
    for (const [code, entry] of this.rooms) {
      if (entry.lastActiveAt < cutoff) {
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
