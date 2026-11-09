import type { Face } from './cards.js';
import type { Phase, PowerId, Rank, ScoringMode, Stage, Suit } from './ids.js';
import { MATCH_TARGET_MAX, MATCH_TARGET_MIN } from './options.js';
import type { CambioEvent, CambioEventType } from './state.js';

/** Looks up a player's display name by id. */
export type NameOf = (playerId: string) => string;

const ranks = {
  A: { name: 'Ace', short: 'A' },
  '2': { name: 'Two', short: '2' },
  '3': { name: 'Three', short: '3' },
  '4': { name: 'Four', short: '4' },
  '5': { name: 'Five', short: '5' },
  '6': { name: 'Six', short: '6' },
  '7': { name: 'Seven', short: '7' },
  '8': { name: 'Eight', short: '8' },
  '9': { name: 'Nine', short: '9' },
  '10': { name: 'Ten', short: '10' },
  J: { name: 'Jack', short: 'J' },
  Q: { name: 'Queen', short: 'Q' },
  K: { name: 'King', short: 'K' },
  joker: { name: 'Joker', short: 'JK' },
} satisfies Record<Rank, { name: string; short: string }>;

const suits = {
  hearts: { name: 'Hearts', symbol: '♥' },
  diamonds: { name: 'Diamonds', symbol: '♦' },
  clubs: { name: 'Clubs', symbol: '♣' },
  spades: { name: 'Spades', symbol: '♠' },
} satisfies Record<Suit, { name: string; symbol: string }>;

const powers = {
  peekOwn: { name: 'Peek', hint: 'Look at one of your own cards.' },
  peekOther: { name: 'Spy', hint: "Look at one of another player's cards." },
  swapOthers: { name: 'Blind Swap', hint: 'Swap two cards between two other players.' },
  swapAny: { name: 'Blind Swap', hint: 'Swap two cards between any two players, you included.' },
  peekSwap: {
    name: 'Peek and Swap',
    hint: 'Look at any card, then you may swap it with a card of a different player.',
  },
} satisfies Record<PowerId, { name: string; hint: string }>;

const phases = {
  peek: 'Peek at your bottom two',
  play: 'Play',
  roundOver: 'Round over',
  over: 'Game over',
} satisfies Record<Phase, string>;

const stages = {
  start: 'Draw a card or call Cambio',
  drawn: 'Swap it into your hand or discard it',
  power: 'Use the power or skip it',
  looking: 'Remember it, then tap done',
  kingDecide: 'Swap it or keep it',
} satisfies Record<Stage, string>;

const scoringModes = {
  single: { name: 'Single round', hint: 'Lowest score after one round wins.' },
  match: { name: 'Match', hint: 'Scores add up across rounds until someone reaches the target.' },
} satisfies Record<ScoringMode, { name: string; hint: string }>;

function cardName(face: Face): string {
  if (face.rank === 'joker' || face.suit === null) return ranks[face.rank].name;
  return `${ranks[face.rank].name} of ${suits[face.suit].name}`;
}

const list = (names: string[]): string =>
  names.length <= 1
    ? (names[0] ?? 'nobody')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** One sentence per public event, for the TV log and screen readers. */
const log = {
  dealt: (e, n) => `Round ${e.round}: cards are dealt and ${n(e.firstPlayerId)} goes first.`,
  ready: (e, n) => `${n(e.playerId)} is ready.`,
  turnStarted: (e, n) => `It is ${n(e.playerId)}'s turn.`,
  drew: (e, n) => `${n(e.playerId)} drew a card.`,
  swapped: (e, n) => `${n(e.playerId)} swapped and discarded the ${cardName(e.discarded.face)}.`,
  discardedDrawn: (e, n) => `${n(e.playerId)} discarded the ${cardName(e.card.face)}.`,
  powerUsed: (e, n) =>
    e.power === 'peekOwn'
      ? `${n(e.playerId)} peeked at one of their cards.`
      : `${n(e.playerId)} peeked at one of ${n(e.target.playerId)}'s cards.`,
  powerSkipped: (e, n) => `${n(e.playerId)} skipped the ${powers[e.power].name}.`,
  blindSwap: (e, n) =>
    `${n(e.playerId)} swapped a card of ${n(e.a.playerId)} with one of ${n(e.b.playerId)}.`,
  kingPeek: (e, n) => `${n(e.playerId)} peeked at one of ${n(e.target.playerId)}'s cards.`,
  kingSwap: (e, n) =>
    `${n(e.playerId)} swapped a card of ${n(e.a.playerId)} with one of ${n(e.b.playerId)}.`,
  snapped: (e, n) =>
    e.snapperId === e.ownerId
      ? `${n(e.snapperId)} snapped the ${cardName(e.card.face)}.`
      : `${n(e.snapperId)} snapped ${n(e.ownerId)}'s ${cardName(e.card.face)} and gave them a card.`,
  snapFailed: (e, n) =>
    `${n(e.snapperId)} snapped the wrong card, the ${cardName(e.card.face)}, and takes a penalty.`,
  cambioCalled: (e, n) => `${n(e.playerId)} called Cambio! Everyone else gets one more turn.`,
  reshuffled: (e) => `The discard pile was shuffled into a new deck of ${e.deckCount}.`,
  roundRevealed: (e, n) => `Round ${e.result.round} goes to ${list(e.result.winners.map(n))}.`,
  gameOver: (e, n) => `${list(e.winners.map(n))} won the game.`,
} satisfies {
  [K in CambioEventType]: (e: Extract<CambioEvent, { type: K }>, name: NameOf) => string;
};

function describe(event: CambioEvent, name: NameOf): string {
  const write = log[event.type] as (e: CambioEvent, n: NameOf) => string;
  return write(event, name);
}

const roundWinner = (names: string[]) =>
  `${list(names)} ${names.length === 1 ? 'wins' : 'win'} the round.`;
const gameWinner = (names: string[]) =>
  `${list(names)} ${names.length === 1 ? 'wins' : 'win'} the game.`;
const YOU = 'You';
const YOU_WIN = 'You win!';
const YOU_WIN_ROUND = 'You win the round!';

/**
 * The winner line on a player's phone. Never pass "You" as a name to the plain templates
 * ("You wins"): pass the other winners here with `youWon`, and you come first in the list.
 */
function winnerLine(kind: 'round' | 'game', others: string[], youWon: boolean): string {
  if (youWon && others.length === 0) return kind === 'game' ? YOU_WIN : YOU_WIN_ROUND;
  const names = youWon ? [YOU, ...others] : others;
  return kind === 'game' ? gameWinner(names) : roundWinner(names);
}

const errors = {
  gameOver: 'The game is over.',
  notSeated: 'You are not in this game.',
  notPeekPhase: 'The initial peek is over.',
  alreadyReady: 'You are already ready.',
  notRoundOver: 'The round is still going.',
  notPlaying: 'Not during play.',
  notYourTurn: 'It is not your turn.',
  wrongStage: 'You cannot do that right now.',
  cannotCallYet: 'You can call Cambio once everyone has taken a turn.',
  alreadyCalled: 'Cambio has already been called.',
  notYourSlot: 'That is not one of your cards.',
  noSuchSlot: 'That card is not there.',
  badTarget: 'You cannot target that card.',
  sameSlot: 'Pick two different cards.',
  samePlayer: 'Pick cards from two different players.',
  locked: "The caller's cards are locked.",
  peekMoved: 'The card you peeked at has moved.',
  snapTooLate: 'Too late: that card has already moved.',
  giveRequired: 'Choose one of your cards to give.',
  giveNotAllowed: 'No card to give for this snap.',
  noSnapping: 'Snapping is closed right now.',
};

export const theme = {
  title: 'Cambio',
  tagline: 'Lowest hand wins. Remember what you peek, snap what matches.',
  ranks,
  suits,
  /** Words for cards as drawn on screen. */
  cards: {
    faceDown: 'Face-down card',
  },
  powers,
  phases,
  stages,
  scoringModes,
  options: {
    scoringMode: { label: 'Scoring', hint: 'One round, or a match to a target score.' },
    matchTarget: {
      label: 'Match target',
      hint: `The match ends when anyone reaches this total (${MATCH_TARGET_MIN} to ${MATCH_TARGET_MAX}).`,
    },
    lockCaller: {
      label: 'Lock the caller',
      hint: "After Cambio is called, the caller's cards can't be swapped, snapped, or given to.",
    },
    rememberPeeks: {
      label: 'Remember peeks',
      hint: 'Phones keep showing cards you have seen in your hand until they move.',
    },
  },
  actions: {
    ready: "I'm ready",
    continue: 'Next round',
    draw: 'Draw',
    callCambio: 'Call Cambio',
    swap: 'Swap',
    discard: 'Discard',
    donePeek: 'Done',
    kingSwap: 'Swap',
    skipPower: 'Skip',
    keep: 'Keep',
    snap: 'Snap',
  },
  cardName,
  log,
  describe,
  errors,
  /** Words on the player's phone. */
  phone: {
    you: YOU,
    yourHand: 'Your cards',
    yourCard: (n: number) => `Your card ${n}`,
    theirCard: (name: string, n: number) => `${name}'s card ${n}`,
    cardCount: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`,
    known: 'You know this card',
    holdToPeek: 'Press and hold your cards to peek at your bottom two',
    peekAgain: 'Hold to look again',
    waitingForOthers: 'Waiting for everyone to be ready',
    yourTurn: 'Your turn',
    turnOf: (name: string) => `${name}'s turn`,
    drewHint: 'Tap one of your cards to swap it in, or discard it',
    usePower: 'Use it',
    pickOne: 'Pick a card',
    pickFirst: 'Pick the first card',
    pickSecond: 'Pick the second card, from a different player',
    pickSwap: 'Pick a card to swap it with, or keep',
    pickOwn: 'Tap one of your cards',
    lookingAt: (card: string) => `It's the ${card}`,
    snapOther: "Snap another player's card",
    snapPick: 'Pick the card to snap',
    snapHint: 'Swipe a card up to snap it',
    chooseGive: 'Tap one of your cards to give',
    cancel: 'Cancel',
    wrongSnap: 'Wrong snap: a penalty card for you',
    wrongSnapBy: (name: string) => `${name} snapped wrong`,
    tooLate: 'Too late',
    called: (name: string) => `${name} called Cambio`,
    youCalled: 'You called Cambio',
    turnsLeft: (n: number) =>
      n === 0 ? 'Last turn is over' : n === 1 ? '1 turn left' : `${n} turns left`,
    locked: 'Locked',
    yourScore: 'Your score',
    standings: 'This round',
    total: 'Total',
    totals: 'Match totals',
    waitingForVip: 'Waiting for the VIP to start the next round',
    playAgain: 'Play again',
    backToLobby: 'Back to lobby',
    caller: 'Called',
    /** Under a card someone else is peeking at; never shown for your own peeks. */
    peekedBy: (name: string) => `${name} looked at this`,
    /** A mini hand, for screen readers. Only for other players. */
    miniHand: (name: string, cards: number, theirTurn: boolean) =>
      `${name}, ${cards} ${cards === 1 ? 'card' : 'cards'}${theirTurn ? ', their turn' : ''}`,
  },
  results: {
    /** For the TV and logs, with real names. Phones use `winnerLine`. */
    roundWinner,
    gameWinner,
    youWin: YOU_WIN,
    youWinRound: YOU_WIN_ROUND,
    winnerLine,
    score: (points: number) => `${points} ${Math.abs(points) === 1 ? 'point' : 'points'}`,
  },
};
