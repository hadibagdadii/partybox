import { theme } from '@partybox/diwan';
import { useEffect, useState } from 'react';
import { herald, useHeraldState, type Voice } from './herald';

/** "Enable the herald": speech can only start from a tap. */
export function HeraldEnable({ className = '' }: { className?: string }) {
  const { enabled } = useHeraldState();
  if (enabled) {
    return <p className={`text-court-emeraldLight ${className}`}>{theme.tv.heraldReady}</p>;
  }
  return (
    <button
      type="button"
      onClick={() => herald.enable()}
      className={`rounded-button bg-gradient-to-b from-court-goldLight to-court-gold px-8 py-3 font-semibold text-court-ink shadow-glow ${className}`}
    >
      {theme.tv.heraldEnable}
    </button>
  );
}

/** Lobby slot on the generic host screen. */
export function HeraldLobbyExtras() {
  return <HeraldEnable className="text-3xl" />;
}

function useVoices(): Voice[] {
  const [voices, setVoices] = useState(herald.voices);
  useEffect(() => herald.onVoicesChanged(() => setVoices(herald.voices())), []);
  return voices;
}

/** Small gear menu: enable, mute, voice, and starting a new room. */
export function HeraldSettings({ newRoom }: { newRoom?: () => void }) {
  const [open, setOpen] = useState(false);
  const { enabled, muted, voiceURI } = useHeraldState();
  const voices = useVoices();
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={theme.tv.settings}
        onClick={() => setOpen((o) => !o)}
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-court-gold/50 text-court-gold"
      >
        <svg viewBox="-12 -12 24 24" width={36} height={36} aria-hidden>
          <g fill="none" stroke="currentColor" strokeWidth={2}>
            <circle r={3.5} />
            <polygon points="0,-10 2.5,-6 7,-7 6,-2.5 10,0 6,2.5 7,7 2.5,6 0,10 -2.5,6 -7,7 -6,2.5 -10,0 -6,-2.5 -7,-7 -2.5,-6" />
          </g>
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={theme.tv.settings}
          className="absolute right-0 top-20 z-50 flex w-[560px] flex-col gap-5 rounded-card border-2 border-court-gold/60 bg-court-dusk p-6 text-tv-sm shadow-lift"
        >
          {!enabled && <HeraldEnable className="text-tv-sm" />}
          <label className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={muted}
              onChange={(e) => herald.setMuted(e.target.checked)}
              className="h-9 w-9 accent-court-gold"
            />
            {theme.tv.heraldMute}
          </label>
          <label className="flex flex-col gap-2">
            {theme.tv.heraldVoice}
            <select
              value={voiceURI ?? ''}
              onChange={(e) => herald.setVoice(e.target.value || null)}
              className="rounded-button bg-court-night px-3 py-2 text-tv-sm"
            >
              <option value="">{theme.tv.heraldDefaultVoice}</option>
              {voices.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          {newRoom && (
            <button
              type="button"
              onClick={newRoom}
              className="self-start rounded-button border-2 border-court-danger/70 px-5 py-2 text-court-parchment"
            >
              {theme.tv.newRoom}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
