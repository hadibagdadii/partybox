import { theme, type CambioAction, type CambioPlayerView, type Face } from '@partybox/cambio';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useHold } from '../../../lib/useHold';
import { buzz, useTurnBuzz } from '../../../lib/vibrate';
import type { PlayerScreenProps } from '../../registry';
import type { Perspective } from '../motion/CardLayer';
import { CambioTable, useSize } from '../motion/CambioTable';
import { handCols, phoneLayout } from '../motion/layout';
import { useCambioMotion } from '../motion/useCambioMotion';
import { CambioBanner, Hint, SnapNotice, type Notice, type NoticeInput } from './Callouts';
import { HandHits } from './HandHits';
import {
  blindFirsts,
  blindPair,
  blindSeconds,
  intentsOf,
  turnsLeft,
  type SnapAction,
} from './intents';
import { MiniHands } from './MiniHands';
import { PeekMarker } from './PeekMarker';
import { RoundEnd } from './RoundEnd';
import { TargetPicker } from './TargetPicker';
import { Btn } from './ui';

/** How long a power peek stays face up before it flips back; holding shows it again. */
export const PEEK_SHOW_MS = 3000;
const NOTICE_MS = { wrong: 2400, tooLate: 1200 } as const;
const EMPTY: Record<string, Face> = {};

/** Dev only: `?slowmo=4` plays the table four times slower, for checking motion by eye. */
const DEV_MOTION = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return {};
  const n = Number(new URLSearchParams(location.search).get('slowmo'));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? { timeScale: n } : {};
})();

interface PickerSpec {
  title: string;
  playerIds: string[];
  enabled: (slotId: string) => boolean;
  onPick: (slotId: string) => void;
  picked: Set<string>;
  faces: Record<string, Face>;
  actions: ReactNode;
}

/**
 * The Cambio phone, portrait and one-handed. Every button and target comes from the server's
 * `legalActions`; every face it draws is one this player may see right now.
 */
export function CambioPhone({ you: seat, game, act, reset, playAgain }: PlayerScreenProps) {
  const view = game as CambioPlayerView;
  const me = view.you?.id ?? null;
  const frame = useCambioMotion(view, DEV_MOTION);
  const { ref, size } = useSize();
  const ids = useMemo(() => view.players.map((p) => p.id), [view.players]);
  // Each hand's grid width, from what the screen shows now; the layout only rebuilds when a
  // hand gains or loses a column.
  const colsKey = JSON.stringify(
    frame.scene.seats.map((s) => [s.playerId, handCols(s.slots.map((x) => x.pos))]),
  );
  const layout = useMemo(() => {
    if (!size || size.w === 0 || !me) return null;
    const cols = Object.fromEntries(JSON.parse(colsKey) as [string, number][]);
    return phoneLayout(size.w, size.h, ids, me, cols);
  }, [size, ids, me, colsKey]);
  const intents = useMemo(() => intentsOf(view), [view]);
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;

  const turn = view.phase === 'play' ? view.turn : null;
  const myTurn = !!turn && turn.playerId === me;
  const stage = myTurn ? turn.stage : null;
  const power = myTurn ? turn.power : null;

  // Local steps of a choice; the server's state always wins over them.
  const [selected, setSelected] = useState<string | null>(null);
  const [snapPicking, setSnapPicking] = useState(false);
  const [giveTarget, setGiveTarget] = useState<string | null>(null);
  const [using, setUsing] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeKey = useRef(0);

  const stepKey = `${view.round}:${view.phase}:${turn?.playerId}:${turn?.stage}`;
  useEffect(() => {
    setUsing(false);
    setFirst(null);
  }, [stepKey]);
  useEffect(() => {
    if (view.phase !== 'play') {
      setSnapPicking(false);
      setGiveTarget(null);
      setSelected(null);
    }
  }, [view.phase]);

  const sel = selected && intents.ownSnaps.has(selected) ? selected : null;
  const giveOptions = giveTarget ? (intents.otherSnaps.get(giveTarget) ?? null) : null;

  useTurnBuzz(myTurn && stage === 'start');

  const show = (n: NoticeInput) => {
    noticeKey.current += 1;
    setNotice({ ...n, key: noticeKey.current } as Notice);
  };
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), NOTICE_MS[notice.kind]);
    return () => clearTimeout(t);
  }, [notice]);

  // Your own wrong snaps, as they arrive in the public log: show the card everyone saw.
  const seen = useRef<{ round: number; n: number } | null>(null);
  useEffect(() => {
    const prev = seen.current;
    seen.current = { round: view.round, n: view.log.length };
    if (!prev || !me) return;
    const fresh = prev.round === view.round ? view.log.slice(prev.n) : [];
    for (const e of fresh) {
      if (e.type === 'snapFailed' && e.snapperId === me) {
        show({ kind: 'wrong', text: theme.phone.wrongSnap, face: e.card.face });
      }
    }
  }, [view.log, view.round, me]);

  // Power peeks: face up for a few seconds, and again while held.
  const peekKey =
    stage === 'looking' || stage === 'kingDecide' ? view.peeks.map((p) => p.cardId).join() : '';
  const [timed, setTimed] = useState(false);
  useEffect(() => {
    if (!peekKey) {
      setTimed(false);
      return;
    }
    setTimed(true);
    const t = setTimeout(() => setTimed(false), PEEK_SHOW_MS);
    return () => clearTimeout(t);
  }, [peekKey]);
  const look = useHold();
  const peekVisible = !!peekKey && (timed || look.held);
  const peeked = peekKey ? (view.peeks[0] ?? null) : null;

  // The initial peek: your bottom two, only while you press and hold.
  const initialPeek = view.phase === 'peek' && intents.ready;
  const peekHold = useHold();

  const perspective = useMemo<Perspective>(() => {
    const privateFaces: Record<string, Face> = {};
    if (view.drawn) privateFaces[view.drawn.cardId] = view.drawn.face;
    if (peekVisible) for (const p of view.peeks) privateFaces[p.cardId] = p.face;
    const handFaces =
      initialPeek && peekHold.held
        ? Object.fromEntries(view.peeks.map((p) => [p.cardId, p.face]))
        : EMPTY;
    return { youId: me, privateFaces, handFaces };
  }, [view.drawn, view.peeks, peekVisible, initialPeek, peekHold.held, me]);

  const send = (a: CambioAction) => void act(a);
  const snap = async (a: SnapAction) => {
    buzz(25);
    setSelected(null);
    setSnapPicking(false);
    setGiveTarget(null);
    const r = await act(a, { quiet: true });
    if (r.ok) return;
    if (r.error.message === theme.errors.snapTooLate) {
      buzz(12);
      show({ kind: 'tooLate', text: theme.phone.tooLate });
    } else {
      show({ kind: 'tooLate', text: r.error.message });
    }
  };

  if (!me) {
    return (
      <div className="grid h-dvh place-items-center bg-cambio-feltDeep p-6 text-center font-card text-xl text-cambio-chalk">
        {theme.errors.notSeated}
      </div>
    );
  }

  const myHand = view.players.find((p) => p.id === me)?.slots ?? [];
  const others = ids.filter((id) => id !== me);
  const known = new Set(view.known.map((k) => k.slotId));
  const peekFaces: Record<string, Face> =
    peeked && peekVisible ? { [peeked.slotId]: peeked.face } : {};
  const peekedMine = !!peeked && peeked.playerId === me;
  const withMe = (enabled: (id: string) => boolean, extra?: string | null) =>
    myHand.some((s) => enabled(s.slotId) || s.slotId === extra) ? ids : others;

  // ---- What your own cards do on a tap or a swipe right now ----
  let handTap: ((slotId: string) => void) | undefined;
  let tappable: (slotId: string) => boolean = () => false;
  let marked = new Set<string>();
  if (giveOptions) {
    const byGive = new Map(giveOptions.map((a) => [a.giveSlotId ?? '', a]));
    tappable = (id) => byGive.has(id);
    marked = new Set(byGive.keys());
    handTap = (id) => {
      const a = byGive.get(id);
      if (a) void snap(a);
    };
  } else if (stage === 'drawn') {
    tappable = (id) => intents.swap.has(id);
    handTap = (id) => send({ type: 'swap', slotId: id });
  } else if (stage === 'power' && power === 'peekOwn') {
    tappable = (id) => intents.peek.has(id);
    marked = intents.peek;
    handTap = (id) => send({ type: 'peek', slotId: id });
  } else if (view.phase === 'play') {
    tappable = (id) => intents.ownSnaps.has(id);
    handTap = (id) => setSelected((s) => (s === id ? null : id));
  }
  const handSwipe =
    view.phase === 'play' && !giveOptions
      ? (id: string) => {
          const a = intents.ownSnaps.get(id);
          if (a) void snap(a);
        }
      : undefined;

  // ---- The target picker ----
  const lookAgain = (
    <Btn className="flex-1" aria-pressed={look.held} {...look.bind}>
      {theme.phone.peekAgain}
    </Btn>
  );
  let picker: PickerSpec | null = null;
  if (snapPicking && !giveOptions && view.phase === 'play') {
    picker = {
      title: theme.phone.snapPick,
      playerIds: others,
      enabled: (id) => intents.otherSnaps.has(id),
      onPick: (id) => {
        const opts = intents.otherSnaps.get(id);
        if (!opts?.length) return;
        if (opts.length === 1 && !opts[0]!.giveSlotId) void snap(opts[0]!);
        else {
          setGiveTarget(id);
          setSnapPicking(false);
        }
      },
      picked: new Set(),
      faces: EMPTY,
      actions: (
        <Btn className="flex-1" onClick={() => setSnapPicking(false)}>
          {theme.phone.cancel}
        </Btn>
      ),
    };
  } else if (stage === 'power' && using && power && power !== 'peekOwn') {
    const skip = (
      <Btn className="flex-1" onClick={() => send({ type: 'skipPower' })}>
        {theme.actions.skipPower}
      </Btn>
    );
    if (power === 'swapOthers' || power === 'swapAny') {
      const pairs = intents.blindPairs;
      const allowed = first ? blindSeconds(pairs, first) : blindFirsts(pairs);
      const enabled = (id: string) => allowed.has(id) || id === first;
      picker = {
        title: first ? theme.phone.pickSecond : theme.phone.pickFirst,
        playerIds: withMe((id) => blindFirsts(pairs).has(id)),
        enabled,
        onPick: (id) => {
          if (!first) return setFirst(id);
          if (id === first) return setFirst(null);
          const pair = blindPair(pairs, first, id);
          if (pair) send({ type: 'blindSwap', slotIds: pair });
        },
        picked: new Set(first ? [first] : []),
        faces: EMPTY,
        actions: skip,
      };
    } else {
      const enabled = (id: string) => intents.peek.has(id);
      picker = {
        title: theme.phone.pickOne,
        playerIds: withMe(enabled),
        enabled,
        onPick: (id) => send({ type: 'peek', slotId: id }),
        picked: new Set(),
        faces: EMPTY,
        actions: skip,
      };
    }
  } else if (stage === 'looking' && peeked && !peekedMine) {
    picker = {
      title: peekVisible
        ? theme.phone.lookingAt(theme.cardName(peeked.face))
        : theme.phone.peekAgain,
      playerIds: [peeked.playerId],
      enabled: () => false,
      onPick: () => undefined,
      picked: new Set([peeked.slotId]),
      faces: peekFaces,
      actions: (
        <>
          {lookAgain}
          <Btn tone="primary" className="flex-1" onClick={() => send({ type: 'donePeek' })}>
            {theme.actions.donePeek}
          </Btn>
        </>
      ),
    };
  } else if (stage === 'kingDecide' && peeked) {
    const enabled = (id: string) => intents.kingSwap.has(id);
    picker = {
      title: peekVisible
        ? `${theme.phone.lookingAt(theme.cardName(peeked.face))}. ${theme.phone.pickSwap}`
        : theme.phone.pickSwap,
      playerIds: withMe(enabled, peeked.slotId),
      enabled,
      onPick: (id) => send({ type: 'kingSwap', slotId: id }),
      picked: new Set([peeked.slotId]),
      faces: peekFaces,
      actions: (
        <>
          {lookAgain}
          <Btn tone="primary" className="flex-1" onClick={() => send({ type: 'skipPower' })}>
            {theme.actions.keep}
          </Btn>
        </>
      ),
    };
  }

  // ---- The action bar ----
  const between = view.phase === 'roundOver' || view.phase === 'over';
  const result = between && view.lastRound?.round === view.round ? view.lastRound : null;
  const revealing = frame.playing?.step.kind === 'reveal';
  let hint = '';
  const rows: ReactNode[] = [];
  if (view.phase === 'peek') {
    if (intents.ready) {
      hint = theme.phone.holdToPeek;
      rows.push(
        <Btn
          key="ready"
          tone="primary"
          big
          className="w-full"
          onClick={() => send({ type: 'ready' })}
        >
          {theme.actions.ready}
        </Btn>,
      );
    } else hint = theme.phone.waitingForOthers;
  } else if (view.phase === 'play') {
    if (giveOptions) {
      hint = theme.phone.chooseGive;
      rows.push(
        <Btn key="cancel" className="w-full" onClick={() => setGiveTarget(null)}>
          {theme.phone.cancel}
        </Btn>,
      );
    } else {
      if (stage === 'start') {
        hint = theme.phone.yourTurn;
        rows.push(
          <div key="turn" className="flex gap-2">
            {intents.draw && (
              <Btn
                tone="primary"
                big
                className="flex-[2]"
                onClick={() => {
                  buzz(30);
                  send({ type: 'draw' });
                }}
              >
                {theme.actions.draw}
              </Btn>
            )}
            {intents.call && (
              <Btn tone="call" big className="flex-1" onClick={() => send({ type: 'callCambio' })}>
                {theme.actions.callCambio}
              </Btn>
            )}
          </div>,
        );
      } else if (stage === 'drawn') {
        hint = theme.phone.drewHint;
        rows.push(
          <Btn
            key="discard"
            tone="primary"
            big
            className="w-full"
            onClick={() => send({ type: 'discard' })}
          >
            {theme.actions.discard}
          </Btn>,
        );
      } else if (stage === 'power' && power) {
        hint = `${theme.powers[power].name}: ${
          power === 'peekOwn' ? theme.phone.pickOwn : theme.powers[power].hint
        }`;
        const targets = intents.peek.size > 0 || intents.blindPairs.length > 0;
        rows.push(
          <div key="power" className="flex gap-2">
            {power !== 'peekOwn' && targets && (
              <Btn tone="primary" big className="flex-[2]" onClick={() => setUsing(true)}>
                {theme.phone.usePower}
              </Btn>
            )}
            {intents.skip && (
              <Btn big className="flex-1" onClick={() => send({ type: 'skipPower' })}>
                {theme.actions.skipPower}
              </Btn>
            )}
          </div>,
        );
      } else if (stage === 'looking' && peekedMine && peeked) {
        hint = peekVisible
          ? theme.phone.lookingAt(theme.cardName(peeked.face))
          : theme.phone.peekAgain;
        rows.push(
          <div key="look" className="flex gap-2">
            {lookAgain}
            <Btn tone="primary" big className="flex-1" onClick={() => send({ type: 'donePeek' })}>
              {theme.actions.donePeek}
            </Btn>
          </div>,
        );
      } else if (turn && !myTurn) {
        hint = `${theme.phone.turnOf(nameOf(turn.playerId))} · ${theme.phone.snapHint}`;
      }
      const snapRow: ReactNode[] = [];
      if (sel) {
        const a = intents.ownSnaps.get(sel)!;
        snapRow.push(
          <Btn key="snap" tone="primary" className="flex-1" onClick={() => void snap(a)}>
            {theme.actions.snap}
          </Btn>,
        );
      }
      if (intents.otherSnaps.size > 0 && stage !== 'drawn') {
        snapRow.push(
          <Btn key="snapOther" className="flex-[2]" onClick={() => setSnapPicking(true)}>
            {theme.phone.snapOther}
          </Btn>,
        );
      }
      if (snapRow.length)
        rows.push(
          <div key="snaps" className="flex gap-2">
            {snapRow}
          </div>,
        );
    }
  } else if (result) {
    if (view.phase === 'roundOver') {
      if (seat.isVip && intents.continue) {
        rows.push(
          <Btn
            key="next"
            tone="primary"
            big
            className="w-full"
            onClick={() => send({ type: 'continue' })}
          >
            {theme.actions.continue}
          </Btn>,
        );
      } else hint = theme.phone.waitingForVip;
    } else {
      if (playAgain)
        rows.push(
          <Btn key="again" tone="primary" big className="w-full" onClick={playAgain}>
            {theme.phone.playAgain}
          </Btn>,
        );
      if (reset)
        rows.push(
          <Btn key="lobby" className="w-full" onClick={reset}>
            {theme.phone.backToLobby}
          </Btn>,
        );
    }
  }

  const caller = view.callerId;
  const bannerText =
    caller && view.phase === 'play'
      ? caller === me
        ? theme.phone.youCalled
        : theme.phone.called(nameOf(caller))
      : null;

  return (
    <div
      ref={ref}
      data-testid="cambio-phone"
      className="no-select fixed inset-0 overflow-hidden bg-cambio-feltDeep font-card text-cambio-chalk antialiased"
    >
      <CambioTable
        view={view}
        frame={frame}
        perspective={perspective}
        layout={layout}
        plates={false}
        className="absolute inset-0"
      />
      {layout && (
        <>
          <MiniHands view={view} layout={layout} frame={frame} />
          <PeekMarker view={view} layout={layout} frame={frame} />
          <CambioBanner
            layout={layout}
            text={bannerText}
            turns={theme.phone.turnsLeft(turnsLeft(view))}
          />
          <HandHits
            layout={layout}
            me={me}
            slots={myHand}
            hold={initialPeek ? peekHold.bind : undefined}
            onTap={handTap}
            onSwipe={handSwipe}
            tappable={tappable}
            selected={sel}
            marked={marked}
            known={known}
          />
          <SnapNotice layout={layout} notice={notice} />
          {result && !revealing && <RoundEnd view={view} result={result} layout={layout} />}
          {picker ? (
            <TargetPicker
              view={view}
              title={picker.title}
              playerIds={picker.playerIds}
              enabled={picker.enabled}
              onPick={picker.onPick}
              picked={picker.picked}
              faces={picker.faces}
            >
              {picker.actions}
            </TargetPicker>
          ) : (
            <div
              data-testid="action-bar"
              className="pb-safe absolute inset-x-0 bottom-0 z-[100] flex flex-col justify-end gap-2 px-4 pb-3"
              style={{ top: layout.regions.actionTop }}
            >
              <Hint text={hint} />
              {rows}
            </div>
          )}
        </>
      )}
    </div>
  );
}
