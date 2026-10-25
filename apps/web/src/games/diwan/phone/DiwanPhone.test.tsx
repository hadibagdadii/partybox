import { theme, type DiwanAction, type DiwanPlayerView } from '@partybox/diwan';
import type { LobbyView } from '@partybox/shared';
import { act as flush, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiwanPhone } from './DiwanPhone';
import { DiwanLobby } from './screens/DiwanLobby';
import { scenarios, type ScenarioId } from './fixtures';

const room: LobbyView = {
  code: 'BCDF',
  gameId: 'diwan',
  gameName: 'Diwan',
  minPlayers: 5,
  maxPlayers: 10,
  phase: 'playing',
  players: [],
  tutorial: null,
};

let seat = 0;
function renderPhone(view: DiwanPlayerView) {
  const act = vi.fn<(action: unknown) => Promise<void>>(async () => undefined);
  const seatKey = `test:${++seat}`;
  const ui = (v: DiwanPlayerView) => (
    <DiwanPhone
      room={room}
      you={{ id: 'p1', name: 'Amina', isVip: true }}
      game={v}
      act={act}
      seatKey={seatKey}
      reset={null}
      playAgain={null}
    />
  );
  const result = render(ui(view), { wrapper: MemoryRouter });
  return { act, rerender: (v: DiwanPlayerView) => result.rerender(ui(v)) };
}

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const sent = (act: ReturnType<typeof renderPhone>['act']) => act.mock.calls.map(([a]) => a);

afterEach(cleanup);

describe('voting', () => {
  it('shows the current vote and lets the player change it', async () => {
    const { act, rerender } = renderPhone(scenarios.vote);
    const yes = button(new RegExp(theme.votes.yes.label));
    const no = button(new RegExp(theme.votes.no.label));
    expect(yes.getAttribute('aria-pressed')).toBe('true');
    expect(no.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByText(theme.phone.voteYours(theme.votes.yes.label))).toBeTruthy();

    await flush(async () => fireEvent.click(no));
    expect(sent(act)).toEqual([{ type: 'vote', vote: 'no' }]);

    rerender({ ...scenarios.vote, myVote: 'no' });
    expect(button(new RegExp(theme.votes.no.label)).getAttribute('aria-pressed')).toBe('true');
    expect(button(new RegExp(theme.votes.yes.label)).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('confirm steps', () => {
  it('nominates only after a pick and a confirm', async () => {
    const { act } = renderPhone(scenarios.nominate);
    const confirm = button(theme.actions.nominate);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button('Omar'));
    expect(act).not.toHaveBeenCalled();
    await flush(async () => fireEvent.click(button(`${theme.actions.nominate}: Omar`)));
    expect(sent(act)).toEqual([{ type: 'nominate', targetId: 'p4' }]);
  });

  it('discards the chosen decree only after confirm', async () => {
    const { act } = renderPhone(scenarios.discard);
    const cards = screen.getAllByRole('button', { name: theme.decrees.rebel });
    fireEvent.click(cards[1]!);
    expect(act).not.toHaveBeenCalled();
    await flush(async () => fireEvent.click(button(theme.actions.ameerDiscard)));
    expect(sent(act)).toEqual([{ type: 'ameerDiscard', index: 2 }]);
  });

  it('enacts the chosen decree only after confirm', async () => {
    const { act } = renderPhone(scenarios.enact);
    fireEvent.click(button(theme.decrees.loyal));
    expect(act).not.toHaveBeenCalled();
    await flush(async () => fireEvent.click(button(theme.actions.wazirEnact)));
    expect(sent(act)).toEqual([{ type: 'wazirEnact', index: 0 }]);
  });

  it('asks "are you sure" before an exile', async () => {
    const { act } = renderPhone(scenarios.exile);
    fireEvent.click(button('Omar'));
    fireEvent.click(button(`${theme.powers.execution}: Omar`));
    expect(act).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(theme.phone.exileSure('Omar'))).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: theme.phone.cancel }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(act).not.toHaveBeenCalled();

    fireEvent.click(button(`${theme.powers.execution}: Omar`));
    await flush(async () => fireEvent.click(button(theme.phone.exileYes)));
    expect(sent(act)).toEqual([{ type: 'execution', targetId: 'p4' }]);
  });

  it('sends a spy without the extra exile question', async () => {
    const { act } = renderPhone(scenarios.investigate);
    fireEvent.click(button('Layla'));
    await flush(async () => fireEvent.click(button(`${theme.powers.investigate}: Layla`)));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent(act)).toEqual([{ type: 'investigate', targetId: 'p3' }]);
  });
});

describe('legal actions', () => {
  it('offers only the eligible nominees', () => {
    renderPhone(scenarios.nominate);
    const cards = screen
      .getAllByRole('button')
      .filter(
        (b) => b.getAttribute('aria-pressed') !== null && !/My role/.test(b.textContent ?? ''),
      );
    expect(cards.map((c) => c.textContent)).toEqual(['Layla', 'Omar', 'Zainab', 'Noor']);
  });

  it('shows the Joint Veto only when the server offers it', () => {
    renderPhone(scenarios.enact);
    expect(screen.queryByRole('button', { name: theme.actions.proposeVeto })).toBeNull();
    cleanup();
    renderPhone(scenarios.enactVeto);
    expect(button(theme.actions.proposeVeto)).toBeTruthy();
  });

  it('shows no action buttons while waiting', () => {
    renderPhone(scenarios.waiting);
    const names = screen
      .getAllByRole('button')
      .filter((b) => b.dataset.testid !== 'court-strip')
      .map((b) => b.textContent);
    expect(names).toEqual([theme.phone.myRole, theme.phone.courtRecord]);
  });

  // Click everything on every screen; whatever reaches the server must be a legal action.
  it.each(Object.keys(scenarios) as ScenarioId[])('%s sends only legal actions', async (id) => {
    const view = scenarios[id];
    const { act } = renderPhone(view);
    for (let pass = 0; pass < 3; pass++) {
      for (const b of screen.queryAllByRole('button')) {
        if (b.textContent === theme.phone.courtRecord || b.dataset.testid === 'court-strip')
          continue;
        if (!b.isConnected) continue;
        await flush(async () => fireEvent.click(b));
      }
    }
    for (const action of sent(act) as DiwanAction[]) {
      expect(view.legalActions).toContainEqual(action);
    }
  });
});

describe('private results', () => {
  it('shows a new spy result until Done, then remembers it was seen', () => {
    const { rerender } = renderPhone(scenarios.spy);
    expect(screen.getByText(theme.phone.spySecret('Zainab', theme.teams.rebel))).toBeTruthy();
    fireEvent.click(button(theme.phone.done));
    expect(screen.getByRole('heading', { name: theme.phases.nominate })).toBeTruthy();
    rerender({ ...scenarios.spy });
    expect(screen.queryByRole('button', { name: theme.phone.done })).toBeNull();
  });

  it('peeks at your role only while the header button is held', () => {
    renderPhone(scenarios.reveal);
    const peek = button(theme.phone.myRole);
    expect(screen.queryByTestId('role-peek')).toBeNull();
    fireEvent.pointerDown(peek);
    expect(within(screen.getByTestId('role-peek')).getByText(theme.roles.rebel)).toBeTruthy();
    fireEvent.pointerUp(peek);
    expect(screen.queryByTestId('role-peek')).toBeNull();
  });

  it('opens the court record grouped by round', () => {
    renderPhone(scenarios.waiting);
    fireEvent.click(button(theme.phone.courtRecord));
    const sheet = screen.getByRole('dialog', { name: theme.phone.courtRecord });
    const rounds = within(sheet).getAllByTestId('record-round');
    expect(rounds).toHaveLength(1);
    expect(within(rounds[0]!).getByText(theme.record.round(1))).toBeTruthy();
    expect(within(rounds[0]!).getByText(theme.record.nominated('Idris', 'Layla'))).toBeTruthy();
    expect(within(rounds[0]!).getByText(theme.record.vote(true, 4, 3))).toBeTruthy();
  });
});

describe('court strip', () => {
  it('shows tracks, unrest, and the government on every in-game screen', () => {
    for (const id of Object.keys(scenarios) as ScenarioId[]) {
      renderPhone(scenarios[id]);
      expect(screen.getByTestId('court-strip')).toBeTruthy();
      cleanup();
    }
    renderPhone(scenarios.vote);
    const strip = screen.getByTestId('court-strip');
    expect(within(strip).getByText('1/5')).toBeTruthy();
    expect(within(strip).getByText('2/6')).toBeTruthy();
    expect(within(strip).getByText('1/3')).toBeTruthy();
    expect(within(strip).getByText('Yusuf')).toBeTruthy();
    expect(within(strip).getByText('Omar')).toBeTruthy();
  });

  it('opens the court record when tapped', () => {
    renderPhone(scenarios.waiting);
    fireEvent.click(screen.getByTestId('court-strip'));
    expect(screen.getByRole('dialog', { name: theme.phone.courtRecord })).toBeTruthy();
  });
});

describe('rules', () => {
  it('shows a scrollable summary of the seven topics in the court record sheet', () => {
    renderPhone(scenarios.vote);
    fireEvent.click(button(theme.phone.courtRecord));
    fireEvent.click(screen.getByRole('tab', { name: theme.phone.rulesTab }));
    const sheet = screen.getByRole('dialog', { name: theme.rules.title });
    const topics = within(sheet).getAllByRole('listitem');
    expect(topics).toHaveLength(7);
    for (const slide of theme.tutorial.slides)
      expect(within(sheet).getByText(slide.body)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: theme.phone.recordTab }));
    expect(screen.getByRole('dialog', { name: theme.phone.courtRecord })).toBeTruthy();
  });
});

describe('game over', () => {
  function renderOver(vip: boolean) {
    const reset = vi.fn();
    const playAgain = vi.fn();
    render(
      <DiwanPhone
        room={{ ...room, phase: 'over' }}
        you={{ id: 'p1', name: 'Amina', isVip: vip }}
        game={scenarios.gameOver}
        act={async () => undefined}
        seatKey="test:over"
        reset={vip ? reset : null}
        playAgain={vip ? playAgain : null}
      />,
      { wrapper: MemoryRouter },
    );
    return { reset, playAgain };
  }

  it('gives the VIP Play again and Back to lobby, and everyone an About link', () => {
    const { reset, playAgain } = renderOver(true);
    fireEvent.click(button(theme.phone.playAgain));
    fireEvent.click(button(theme.phone.backToLobby));
    expect(playAgain).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: theme.phone.about }).getAttribute('href')).toBe(
      '/about',
    );
  });

  it('gives other players only the About link', () => {
    renderOver(false);
    expect(screen.queryByRole('button', { name: theme.phone.playAgain })).toBeNull();
    expect(screen.getByRole('link', { name: theme.phone.about })).toBeTruthy();
  });
});

describe('lobby', () => {
  function renderLobby(canStart: boolean) {
    const fns = { start: vi.fn(), startTutorial: vi.fn(), leave: vi.fn() };
    render(
      <DiwanLobby
        room={{ ...room, phase: 'lobby' }}
        you={{ id: 'p1', name: 'Amina', isVip: canStart }}
        canStart={canStart}
        {...fns}
      />,
    );
    return fns;
  }

  it('offers the VIP the tutorial or starting now', () => {
    const { start, startTutorial } = renderLobby(true);
    fireEvent.click(button(theme.tutorial.startWith));
    fireEvent.click(button(theme.tutorial.startNow));
    expect(startTutorial).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
  });

  it('asks before leaving the room', () => {
    const { leave } = renderLobby(false);
    expect(screen.queryByRole('button', { name: theme.tutorial.startWith })).toBeNull();
    fireEvent.click(button(theme.phone.leaveRoom));
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(button(theme.phone.leaveYes));
    expect(leave).toHaveBeenCalledOnce();
  });
});
