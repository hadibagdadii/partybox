import { theme, type DiwanHostView, type DiwanPlayerView } from '@partybox/diwan';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playerView } from '../phone/fixtures';
import { DiwanTv } from './DiwanTv';
import { fixtureRoom, hostView, scenes, type Scene, type SceneId } from './fixtures';
import { FLIP_AT } from './moments/VoteCards';
import { ROLE_STEP_MS } from './moments/GameOver';
import { MOMENT_MS } from './useMoments';

function renderTv(view: DiwanHostView) {
  const ui = (v: DiwanHostView) => <DiwanTv room={fixtureRoom(v)} game={v} />;
  const result = render(ui(view), { wrapper: MemoryRouter });
  return { rerender: (v: DiwanHostView) => result.rerender(ui(v)) };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const roleNames = Object.values(theme.roles);
const stageText = () => screen.getByTestId('tv-stage').textContent ?? '';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('secrets', () => {
  const allScenes = Object.entries(scenes) as [SceneId, Scene][];
  const live = allScenes.filter(([, s]) => s.view.phase !== 'over');

  it.each(live)('%s shows no roles', (_, scene) => {
    for (const view of [scene.before, scene.view]) {
      if (!view) continue;
      renderTv(view);
      for (const role of roleNames) expect(screen.queryByText(role)).toBeNull();
      expect(stageText()).not.toContain(theme.roles.loyal);
      expect(stageText()).not.toContain(theme.roles.usurper);
      expect(screen.queryAllByTestId('role-card')).toHaveLength(0);
      cleanup();
    }
  });

  it('ignores private fields even if a player view is passed in by mistake', () => {
    const leaky: DiwanPlayerView = playerView({
      phase: 'wazirEnact',
      nomineeId: 'p1',
      waitingOn: ['p1'],
      you: { id: 'p1', role: 'usurper', team: 'rebel', alive: true },
      knownRoles: { p1: 'usurper', p3: 'rebel' },
      hand: ['rebel', 'rebel'],
      peek: ['loyal', 'loyal', 'loyal'],
      secrets: [{ type: 'investigate', targetId: 'p4', team: 'loyal' }],
    });
    renderTv(leaky);
    for (const role of roleNames) expect(screen.queryByText(role)).toBeNull();
    expect(stageText()).not.toContain(theme.roles.usurper);
    // Only enacted decrees are drawn: one Loyal, two Rebel, never the hand.
    const filled = (decree: string) =>
      within(screen.getByTestId(`track-${decree}`))
        .queryAllByRole('listitem')
        .filter((li) => li.dataset.filled);
    expect(filled('loyal')).toHaveLength(1);
    expect(filled('rebel')).toHaveLength(2);
  });

  it('turns over every role one by one once the game is over', () => {
    renderTv(scenes.gameOver.view);
    expect(screen.getAllByTestId('role-card')).toHaveLength(7);
    const up = () => document.querySelectorAll('[data-face="up"]').length;
    expect(up()).toBe(0);
    advance(ROLE_STEP_MS * 1.5);
    expect(up()).toBe(1);
    for (let i = 2; i <= 7; i++) {
      advance(ROLE_STEP_MS);
      expect(up()).toBe(i);
    }
    expect(
      screen.getByText(theme.tv.gameOverTitle(theme.teams.loyal), { selector: 'h2' }),
    ).toBeTruthy();
  });
});

describe('vote reveal', () => {
  const faces = (face: string) =>
    within(screen.getByTestId('vote-cards')).queryAllByText(
      (_, el) => el?.getAttribute('data-face') === face,
    );

  it('shows who has voted face-down, never how', () => {
    renderTv(scenes.vote.view);
    expect(faces('down')).toHaveLength(scenes.vote.view.votedIds.length);
    expect(faces('empty')).toHaveLength(3);
    expect(faces('up')).toHaveLength(0);
    expect(screen.queryByText(theme.votes.yes.label)).toBeNull();
    expect(screen.queryByText(theme.votes.no.label)).toBeNull();
  });

  it('flips all cards on votesRevealed, then moves the votes onto the tiles until the next nomination', () => {
    const { before, view } = scenes.voteReveal;
    const { rerender } = renderTv(before);
    expect(faces('down')).toHaveLength(6);
    expect(screen.queryByText(theme.votes.yes.label)).toBeNull();

    rerender(view);
    expect(faces('down')).toHaveLength(7);
    advance(FLIP_AT);
    expect(faces('up')).toHaveLength(7);
    expect(screen.getByRole('status').textContent).toBe(theme.tv.voteTally(true, 5, 2));
    // Badges wait until the cards have left.
    expect(screen.queryAllByTestId('vote-badge')).toHaveLength(0);

    advance(MOMENT_MS.voteReveal.full);
    expect(screen.queryByTestId('vote-cards')).toBeNull();
    const badges = screen.getAllByTestId('vote-badge');
    expect(badges).toHaveLength(7);
    const p3 = within(screen.getByTestId('tile-p3')).getByTestId('vote-badge');
    expect(p3.dataset.vote).toBe('no');
    expect(within(p3).getByText(theme.votes.no.label)).toBeTruthy();
    // Screen readers hear who voted and the plain-English gloss.
    expect(within(p3).getByText('Layla voted Laa (No)').className).toContain('sr-only');

    // Still there while the table argues through legislation...
    rerender({ ...view, phase: 'wazirEnact', waitingOn: ['p4'] });
    expect(screen.getAllByTestId('vote-badge')).toHaveLength(7);
    // ...and gone at the next nomination.
    rerender(
      hostView({
        phase: 'vote',
        ameerId: 'p3',
        nomineeId: 'p5',
        log: [...view.log, { type: 'nominated', ameerId: 'p3', wazirId: 'p5' }],
      }),
    );
    expect(screen.queryAllByTestId('vote-badge')).toHaveLength(0);
  });

  it('does not replay history after a refresh', () => {
    renderTv(scenes.voteReveal.view);
    expect(screen.queryByTestId('vote-cards')).toBeNull();
    expect(screen.getAllByTestId('vote-badge')).toHaveLength(7);
  });
});

describe('table', () => {
  it('marks offices, term limits, exiles, and dropped phones', () => {
    const view = scenes.exile.view;
    render(<DiwanTv room={fixtureRoom(view, ['p7'])} game={view} />, { wrapper: MemoryRouter });
    expect(screen.getByTestId('tile-p3').dataset.office).toBe('ameer');
    expect(within(screen.getByTestId('tile-p4')).getByTestId('term-limit')).toBeTruthy();
    expect(screen.getByTestId('tile-p5').dataset.exiled).toBe('true');
    expect(within(screen.getByTestId('tile-p7')).getByTestId('away')).toBeTruthy();
  });

  it('checks off players as they read their roles', () => {
    renderTv(scenes.reveal.view);
    expect(screen.getByTestId('night-scene')).toBeTruthy();
    for (const id of ['p1', 'p3', 'p4']) {
      expect(within(screen.getByTestId(`tile-${id}`)).getByTestId('tile-check')).toBeTruthy();
    }
    expect(within(screen.getByTestId('tile-p2')).queryByTestId('tile-check')).toBeNull();
  });

  it('gives one instruction line and a waiting line', () => {
    renderTv(scenes.nominate.view);
    expect(screen.getByTestId('instruction').textContent).toBe(
      theme.tv.instruction.nominate('Yusuf'),
    );
    expect(screen.getByTestId('waiting-line').textContent).toContain('Yusuf');
  });

  it('shows a Riot on the track', () => {
    const { rerender } = renderTv(scenes.riot.before);
    rerender(scenes.riot.view);
    advance(MOMENT_MS.voteReveal.full);
    expect(screen.getByTestId('unrest').textContent).toBe('3/3');
    advance(MOMENT_MS.riot.full);
    expect(screen.getByTestId('unrest').textContent).toBe('0/3');
    expect(within(screen.getByTestId('track-rebel')).getByText(theme.tv.riotTag)).toBeTruthy();
  });
});

describe('ending the game', () => {
  function renderWithEnd(view: DiwanHostView, room = fixtureRoom(view)) {
    const endGame = vi.fn();
    render(<DiwanTv room={room} game={view} endGame={endGame} />, { wrapper: MemoryRouter });
    return endGame;
  }

  it('ends the game from the gear menu only after a confirm', () => {
    const endGame = renderWithEnd(scenes.nominate.view);
    act(() => screen.getByRole('button', { name: theme.tv.settings }).click());
    act(() => screen.getByRole('button', { name: theme.tv.endGame }).click());
    expect(endGame).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: theme.tv.endGameSure })).toBeTruthy();
    act(() => screen.getByRole('button', { name: theme.tv.endGameYes }).click());
    expect(endGame).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: theme.tv.about })).toBeTruthy();
  });

  it('gently suggests waiting or ending once someone has been away a while', () => {
    const view = scenes.nominate.view;
    const base = fixtureRoom(view, ['p7']);
    const quiet = renderWithEnd(view, base);
    expect(screen.queryByTestId('away-prompt')).toBeNull();
    cleanup();

    const room = {
      ...base,
      players: base.players.map((p) => (p.id === 'p7' ? { ...p, awayLong: true } : p)),
    };
    const endGame = renderWithEnd(view, room);
    const prompt = screen.getByTestId('away-prompt');
    expect(prompt.textContent).toContain(theme.tv.awayPrompt('Noor'));
    act(() => within(prompt).getByRole('button', { name: theme.tv.awayWait }).click());
    expect(screen.queryByTestId('away-prompt')).toBeNull();
    expect(endGame).not.toHaveBeenCalled();
    expect(quiet).not.toHaveBeenCalled();
  });
});
