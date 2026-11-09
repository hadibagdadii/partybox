import { theme } from '@partybox/cambio';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { herald, useHeraldState, useVoices } from '../../../lib/herald';
import { colors } from '../tokens';
import { enableCambioHerald } from './herald';
import { cardSounds, useCardSoundState } from './sound';

/** On the generic TV lobby: one tap turns on narration and card sounds. */
export function CambioLobbyExtras() {
  const { enabled } = useHeraldState();
  if (enabled) return <p className="text-3xl text-emerald-300">{theme.tv.heraldReady}</p>;
  return (
    <button
      type="button"
      onClick={enableCambioHerald}
      className="rounded-2xl bg-amber-500 px-8 py-3 text-3xl font-semibold text-slate-950 transition-transform duration-150 ease-out active:scale-[0.97]"
    >
      {theme.tv.heraldEnable}
    </button>
  );
}

const rowClass = 'flex min-h-[56px] items-center gap-4';
const checkClass = 'h-9 w-9 shrink-0 accent-[#c7a047]';
const buttonBase =
  'self-start rounded-full px-6 py-2 font-semibold transition-transform duration-150 ease-out active:scale-[0.97]';

/** The gear menu: narration and sounds, the narrator's voice, ending the game, a new room. */
export function CambioSettings({
  newRoom,
  endGame,
}: {
  newRoom?: () => void;
  endGame?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { enabled, muted, voiceURI } = useHeraldState();
  const { muted: soundMuted } = useCardSoundState();
  const voices = useVoices();
  return (
    <div className="relative font-card">
      <button
        type="button"
        aria-expanded={open}
        aria-label={theme.tv.settings}
        onClick={() => setOpen((o) => !o)}
        className="grid h-16 w-16 place-items-center rounded-full transition-transform duration-150 ease-out active:scale-[0.97]"
        style={{ color: colors.brassLight, boxShadow: `inset 0 0 0 2px rgba(199,160,71,.5)` }}
      >
        <svg viewBox="-12 -12 24 24" width={34} height={34} aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth={2}>
            <circle r={3.5} />
            <path d="M0-10v3M0 7v3M-10 0h3M7 0h3M-7-7l2 2M5 5l2 2M-7 7l2-2M5-5l2-2" />
            <circle r={6.5} />
          </g>
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={theme.tv.settings}
          className="absolute right-0 top-20 z-[200] flex w-[540px] flex-col gap-4 rounded-[28px] p-7 text-[26px]"
          style={{
            background: '#06201a',
            color: colors.chalk,
            boxShadow: `0 0 0 1px rgba(233,239,233,.1), 0 30px 60px -20px rgba(0,0,0,.9)`,
          }}
        >
          {!enabled && (
            <button
              type="button"
              onClick={enableCambioHerald}
              className={buttonBase}
              style={{ background: colors.glow, color: colors.ink }}
            >
              {theme.tv.heraldEnable}
            </button>
          )}
          <label className={rowClass}>
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => herald.setMuted(e.target.checked)}
              className={checkClass}
            />
            {theme.tv.heraldMute}
          </label>
          <label className={rowClass}>
            <input
              type="checkbox"
              checked={soundMuted}
              onChange={(e) => cardSounds.setMuted(e.target.checked)}
              className={checkClass}
            />
            {theme.tv.soundMute}
          </label>
          <label className="flex flex-col gap-2">
            {theme.tv.heraldVoice}
            <select
              value={voiceURI ?? ''}
              onChange={(e) => herald.setVoice(e.target.value || null)}
              className="min-h-[56px] rounded-2xl px-3 text-[24px]"
              style={{ background: colors.feltEdge, color: colors.chalk }}
            >
              <option value="">{theme.tv.heraldDefaultVoice}</option>
              {voices.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          {endGame &&
            (confirming ? (
              <div
                role="alertdialog"
                aria-label={theme.tv.endGameConfirm}
                className="flex flex-col gap-3"
              >
                <p>{theme.tv.endGameConfirm}</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={endGame}
                    className={buttonBase}
                    style={{ background: colors.danger, color: 'white' }}
                  >
                    {theme.tv.endGame}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className={buttonBase}
                    style={{ boxShadow: 'inset 0 0 0 2px rgba(233,239,233,.3)' }}
                  >
                    {theme.tv.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={buttonBase}
                style={{ boxShadow: `inset 0 0 0 2px ${colors.danger}` }}
              >
                {theme.tv.endGame}
              </button>
            ))}
          <Link to="/about" className="self-start underline" style={{ color: colors.brassLight }}>
            {theme.tv.about}
          </Link>
          {newRoom && (
            <button
              type="button"
              onClick={newRoom}
              className={buttonBase}
              style={{ boxShadow: 'inset 0 0 0 2px rgba(233,239,233,.3)' }}
            >
              {theme.tv.newRoom}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
