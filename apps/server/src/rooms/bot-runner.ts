import type { Rng } from '@partybox/shared';
import type { RoomService } from './room-service.js';

export const BOT_MIN_DELAY_MS = 500;
export const BOT_MAX_DELAY_MS = 1200;

export interface BotRunnerOptions {
  rooms: RoomService;
  /** The bots' own randomness, separate from every game's Rng. */
  rng: Rng;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Called after a bot's action changes a room, so views can be pushed. */
  onChange: (code: string) => void;
}

/**
 * Dev bots: whenever a game waits on a bot, it picks a random legal action after
 * a short random delay. Lives in the room layer so engines stay pure.
 */
export class BotRunner {
  private readonly rooms: RoomService;
  private readonly rng: Rng;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly onChange: (code: string) => void;
  /** Pending timers by room code, then bot id. */
  private readonly timers = new Map<string, Map<string, NodeJS.Timeout>>();

  constructor(options: BotRunnerOptions) {
    this.rooms = options.rooms;
    this.rng = options.rng;
    this.minDelayMs = options.minDelayMs ?? BOT_MIN_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? BOT_MAX_DELAY_MS;
    this.onChange = options.onChange;
  }

  /** Schedules each bot the room is waiting on and drops timers that went stale. */
  sync(code: string): void {
    const turns = this.rooms.botTurns(code);
    if (turns.length === 0) return this.cancel(code);
    const pending = this.timers.get(code) ?? new Map<string, NodeJS.Timeout>();
    this.timers.set(code, pending);
    const waiting = new Set(turns.map((t) => t.botId));
    for (const [botId, timer] of pending) {
      if (!waiting.has(botId)) {
        clearTimeout(timer);
        pending.delete(botId);
      }
    }
    for (const botId of waiting) {
      if (pending.has(botId)) continue;
      pending.set(
        botId,
        setTimeout(() => this.fire(code, botId), this.delay()),
      );
    }
  }

  cancel(code: string): void {
    const pending = this.timers.get(code);
    if (!pending) return;
    for (const timer of pending.values()) clearTimeout(timer);
    this.timers.delete(code);
  }

  cancelAll(): void {
    for (const code of [...this.timers.keys()]) this.cancel(code);
  }

  /** Bots with a timer pending in `code`. */
  pendingBots(code: string): string[] {
    return [...(this.timers.get(code)?.keys() ?? [])];
  }

  private fire(code: string, botId: string): void {
    this.timers.get(code)?.delete(botId);
    // The game may have moved on since this timer was set; act on the state as it is now.
    const turn = this.rooms.botTurns(code).find((t) => t.botId === botId);
    if (!turn) return;
    const action = turn.actions[this.rng.int(turn.actions.length)];
    const result = this.rooms.act(code, botId, action);
    if (result.ok) this.onChange(code);
    else this.sync(code);
  }

  private delay(): number {
    return this.minDelayMs + this.rng.int(this.maxDelayMs - this.minDelayMs + 1);
  }
}
