/** One host option as the generic TV options panel draws it. Labels come from the game's theme. */
interface BaseField {
  key: string;
  label: string;
  hint?: string;
  /** Hidden unless this returns true for the current values. */
  visibleWhen?: (values: Record<string, unknown>) => boolean;
}

export type OptionField =
  | (BaseField & { kind: 'choice'; choices: { value: string; label: string }[] })
  | (BaseField & { kind: 'boolean' })
  | (BaseField & { kind: 'integer'; min: number; max: number; step?: number });
