import type { Rng } from '@partybox/shared';

/**
 * How dev bots play one game beyond picking a random legal turn move. Lives in the server so
 * engines stay pure; reflexes see only the public host view, never the game state.
 */
export interface BotStrategy {
  /** Which legal actions count as a turn move. Others (e.g. snaps) are left to `reflex`. */
  isTurnAction?(action: unknown): boolean;
  /**
   * An out-of-turn move this bot might make, seen from the host view. `key` names the
   * opportunity (e.g. the top discard) so a bot considers each one once; `action` is null when
   * the bot lets it pass.
   */
  reflex?(hostView: unknown, botId: string, rng: Rng): { key: string; action: unknown } | null;
}
