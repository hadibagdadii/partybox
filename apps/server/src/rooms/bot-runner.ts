import type { AckResult, Rng } from '@partybox/shared';
import type { BotStrategy } from '../bots/strategy.js';
import type { RoomService } from './room-service.js';

export const BOT_MIN_DELAY_MS = 500;
export const BOT_MAX_DELAY_MS = 1200;

/** What came of one out-of-turn bot move. */
export interface ReflexOutcome {
  code: string;
  botId: string;
  action: unknown;
  result: AckResult;
}

export interface BotRunnerOptions {
  rooms: RoomService;
  /** The bots' own randomness, separate from every game's Rng. */
  rng: Rng;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Per game id: out-of-turn moves, built from the host view. */
  strategies?: ReadonlyMap<string, BotStrategy>;
  /** Called after a bot's action changes a room, so views can be pushed. */
  onChange: (code: string) => void;
  /** Test hook: every out-of-turn move a bot made, accepted or not. */
  onReflex?: (outcome: ReflexOutcome) => void;
}

type Timers = Map<string, NodeJS.Timeout>;

/**
 * Dev bots: whenever a game waits on a bot, it picks a random legal action after a short random
 * delay. Games with a strategy also get out-of-turn moves (Cambio snaps), planned from the public
 * host view only. Lives in the room layer so engines stay pure.
 */
export class BotRunner {
  private readonly rooms: RoomService;
  private readonly rng: Rng;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly strategies: ReadonlyMap<string, BotStrategy>;
  private readonly onChange: (code: string) => void;
  private readonly onReflex: ((outcome: ReflexOutcome) => void) | undefined;
  /** Pending turn timers by room code, then bot id. */
  private readonly timers = new Map<string, Timers>();
  /** Pending out-of-turn timers by room code, then bot id. */
  private readonly reflexTimers = new Map<string, Timers>();
  /** The last opportunity each bot considered, by room code then bot id. */
  private readonly considered = new Map<string, Map<string, string>>();

  constructor(options: BotRunnerOptions) {
    this.rooms = options.rooms;
    this.rng = options.rng;
    this.minDelayMs = options.minDelayMs ?? BOT_MIN_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? BOT_MAX_DELAY_MS;
    this.strategies = options.strategies ?? new Map();
    this.onChange = options.onChange;
    this.onReflex = options.onReflex;
  }

  /** Schedules each bot the room is waiting on, drops stale timers, then plans reflexes. */
  sync(code: string): void {
    this.syncTurns(code);
    this.syncReflexes(code);
  }

  cancel(code: string): void {
    for (const map of [this.timers, this.reflexTimers]) {
      for (const timer of map.get(code)?.values() ?? []) clearTimeout(timer);
      map.delete(code);
    }
    this.considered.delete(code);
  }

  cancelAll(): void {
    for (const code of new Set([...this.timers.keys(), ...this.reflexTimers.keys()])) {
      this.cancel(code);
    }
  }

  /** Bots with a turn timer pending in `code`. */
  pendingBots(code: string): string[] {
    return [...(this.timers.get(code)?.keys() ?? [])];
  }

  /** Bots with an out-of-turn move pending in `code`. */
  pendingReflexes(code: string): string[] {
    return [...(this.reflexTimers.get(code)?.keys() ?? [])];
  }

  private syncTurns(code: string): void {
    const turns = this.rooms.botTurns(code);
    const pending = this.timers.get(code) ?? new Map<string, NodeJS.Timeout>();
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
    if (pending.size > 0) this.timers.set(code, pending);
    else this.timers.delete(code);
  }

  /** Each bot looks at the table once per opportunity and maybe schedules a move on what it saw. */
  private syncReflexes(code: string): void {
    const seats = this.rooms.botSeats(code);
    if (seats.length === 0) {
      for (const timer of this.reflexTimers.get(code)?.values() ?? []) clearTimeout(timer);
      this.reflexTimers.delete(code);
      this.considered.delete(code);
      return;
    }
    const strategy = this.strategies.get(seats[0]!.gameId);
    if (!strategy?.reflex) return;
    const view = this.rooms.hostView(code)?.game ?? null;
    const pending = this.reflexTimers.get(code) ?? new Map<string, NodeJS.Timeout>();
    const considered = this.considered.get(code) ?? new Map<string, string>();
    for (const { botId } of seats) {
      if (pending.has(botId)) continue;
      const plan = strategy.reflex(view, botId, this.rng);
      if (!plan || considered.get(botId) === plan.key) continue;
      considered.set(botId, plan.key);
      const { action } = plan;
      if (action === null) continue;
      pending.set(
        botId,
        setTimeout(() => this.fireReflex(code, botId, action), this.delay()),
      );
    }
    this.considered.set(code, considered);
    if (pending.size > 0) this.reflexTimers.set(code, pending);
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

  /** Sends the move as planned, even if the table changed: stale moves are the server's to reject. */
  private fireReflex(code: string, botId: string, action: unknown): void {
    this.reflexTimers.get(code)?.delete(botId);
    const result = this.rooms.act(code, botId, action);
    this.onReflex?.({ code, botId, action, result });
    if (result.ok) this.onChange(code);
  }

  private delay(): number {
    return this.minDelayMs + this.rng.int(this.maxDelayMs - this.minDelayMs + 1);
  }
}
