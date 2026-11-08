import { useEffect, useRef, useState } from 'react';
import type { OptionField } from '../games/options';

export interface OptionsPanelProps {
  fields: OptionField[];
  /** The room's current options, defaults filled in, as the server last sent them. */
  values: Record<string, unknown>;
  /** Sends a partial change; the server validates it and pushes the new values back. */
  onChange: (patch: Record<string, unknown>) => void;
}

/** Host options on the TV lobby, drawn from a game's field list. */
export function OptionsPanel({ fields, values, onChange }: OptionsPanelProps) {
  const shown = fields.filter((f) => !f.visibleWhen || f.visibleWhen(values));
  if (shown.length === 0) return null;
  return (
    <section
      aria-label="Game options"
      className="flex w-full max-w-4xl flex-col gap-4 rounded-3xl bg-slate-900 px-8 py-6"
    >
      {shown.map((field) => (
        <div key={field.key} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col">
            <span id={`option-${field.key}`} className="text-2xl font-semibold">
              {field.label}
            </span>
            {field.hint && <span className="text-lg text-slate-400">{field.hint}</span>}
          </div>
          <Control field={field} value={values[field.key]} onChange={onChange} />
        </div>
      ))}
    </section>
  );
}

function Control({
  field,
  value,
  onChange,
}: {
  field: OptionField;
  value: unknown;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const labelledBy = `option-${field.key}`;
  switch (field.kind) {
    case 'choice':
      return (
        <div role="radiogroup" aria-labelledby={labelledBy} className="flex gap-2">
          {field.choices.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={value === c.value}
              onClick={() => onChange({ [field.key]: c.value })}
              className={`rounded-xl px-5 py-2 text-xl ${
                value === c.value ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      );
    case 'boolean':
      return (
        <button
          type="button"
          role="switch"
          aria-checked={value === true}
          aria-labelledby={labelledBy}
          onClick={() => onChange({ [field.key]: value !== true })}
          className={`h-12 w-24 rounded-full text-xl font-semibold ${
            value === true ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
          }`}
        >
          {value === true ? 'On' : 'Off'}
        </button>
      );
    case 'integer':
      return <IntegerControl field={field} value={value} onChange={onChange} />;
  }
}

function IntegerControl({
  field,
  value,
  onChange,
}: {
  field: Extract<OptionField, { kind: 'integer' }>;
  value: unknown;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const current = typeof value === 'number' ? value : field.min;
  const step = field.step ?? 1;
  // The value the host last chose, until the server echoes it back. Steps count from it, so
  // quick taps add up instead of each starting from the same server value.
  const pending = useRef<number | null>(null);
  if (pending.current === current) pending.current = null;
  const [draft, setDraft] = useState(String(current));
  useEffect(() => setDraft(String(pending.current ?? current)), [current]);
  const clamp = (n: number) => Math.min(field.max, Math.max(field.min, Math.round(n)));
  const base = () => pending.current ?? current;
  const commit = (n: number) => {
    const next = clamp(n);
    setDraft(String(next));
    if (next === base()) return;
    pending.current = next;
    onChange({ [field.key]: next });
  };
  const local = pending.current ?? current;
  const button = 'h-12 w-12 rounded-full bg-slate-800 text-2xl disabled:opacity-40';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label={`${field.label} down`}
        disabled={local <= field.min}
        onClick={() => commit(base() - step)}
        className={button}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-labelledby={`option-${field.key}`}
        min={field.min}
        max={field.max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(Number(draft) || current)}
        onKeyDown={(e) => e.key === 'Enter' && commit(Number(draft) || current)}
        className="w-24 rounded-xl bg-slate-800 px-3 py-2 text-center text-2xl"
      />
      <button
        type="button"
        aria-label={`${field.label} up`}
        disabled={local >= field.max}
        onClick={() => commit(base() + step)}
        className={button}
      >
        +
      </button>
    </div>
  );
}
