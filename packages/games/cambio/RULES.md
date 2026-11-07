# Cambio rules

## Players and deck

2 to 12 players. 2 to 8 players use one deck (52 cards plus 2 Jokers); 9 to 12 use two decks shuffled together. Values: Joker 0, red King -1, Ace 1, 2 to 10 face value, Jack 10, Queen 10, black King 10.

## Setup

Deal 4 cards face down to each player in a 2x2 grid. Before the first turn, each player privately peeks at their two bottom cards once, then confirms they're ready. Flip the top card of the deck to start the discard pile (no power). A random player goes first; play passes clockwise.

## Turn

Draw the top card of the deck (only you see it; no taking from the discard pile). Then either swap it face down for any one of your cards and discard the replaced card face up (no power), or discard the drawn card face up and optionally use its power. Instead of drawing, you may call Cambio at the start of your turn.

## Powers

Only when discarding the card you just drew:

- 7 or 8: peek at one of your own cards.
- 9 or 10: peek at one card of another player.
- Jack: blind swap two cards between two other players (never your own).
- Queen: blind swap two cards between any two different players (yours included).
- Black King: peek at any one card, then optionally swap it with a card of a different player (yours included).
- Red King, Joker, and all other cards: no power.

## Snapping

Whenever a card is face up on top of the discard pile, any player may snap a card of the same rank onto it, on their turn or not. Ranks match by rank only (red and black Kings are both K; Jokers match Jokers). Snapping your own card puts it on the discard. Snapping another player's card puts it on the discard, then you give that player one of your cards face down, unseen. A wrong snap shows the card to everyone, returns it face down to its slot, and the snapper takes one penalty card from the deck face down without looking. A snapped card becomes the new top discard, so more of that rank can follow. Snapped cards never trigger powers. If two players snap the same card, the first to reach the server wins and the second is rejected with no penalty. No snapping during the initial peek or after the round ends.

## Calling Cambio

At the start of your turn, instead of drawing, once every player has taken at least one turn. Every other player gets exactly one more turn, then the round ends. With lockCaller on, the caller's cards can't be swapped by powers or snapped by others, and the caller can't be given cards.

## Deck runs out

Shuffle the discard pile except its top card into a new deck.

## End of round

Reveal all cards. Score is the sum of your cards; an empty hand scores 0. Lowest score wins. If the caller ties for lowest, the tied non-caller wins; tied non-callers share the win.

## Host options

- scoringMode: single round or match (scores add up across rounds; when anyone reaches matchTarget, default 100, the match ends and the lowest total wins).
- lockCaller (default on).
- rememberPeeks (default off).

## Engine notes

The spec above does not cover these cases, so the engine handles them as follows:

1. A snap names the card id it targets. If that slot is gone or now holds a different card, the snap is rejected with no penalty. That is how the second of two snaps on the same card is rejected.
2. A snap is checked against the top discard when it reaches the server.
3. When you snap another player's card, the card you give goes into the slot the snapped card left. A snapper with an empty hand gives nothing.
4. The deck is reshuffled when a card is needed and the deck is empty. Reshuffled cards get new ids. If there is still no card, a penalty card is skipped, and a draw ends the round at once (it is scored normally).
5. Using a power is always optional. A power with no legal target is skipped automatically.
6. A peek stays open until the player says they are done, so the card stays on their phone. If the card a black King peeked at moves before the swap decision, the player can only keep.
7. lockCaller blocks swaps, snaps by others, and gives involving the caller. It does not block peeks at the caller's cards.
8. Calling Cambio ends the caller's turn. The round ends when play comes back around to the caller.
9. After a round, one continue from any player starts the next round. Each round has a fresh deck with new card ids, a new random first player, and a new initial peek.
10. Players tied for the lowest match total share the win. In single mode, the round winners win the game.
11. scoringMode defaults to single. matchTarget is a whole number from 10 to 500.
12. With rememberPeeks on, you keep seeing a card in your own hand that you have seen while it was there or as it arrived: your initial peek, a 7 or 8 peek, a black King peek of your own card, a drawn card you swapped in, a card a black King swap brought you after you peeked at it, and your own card shown by a wrong snap. You forget it when it leaves your hand.
