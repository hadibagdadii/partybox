import { MATCH_TARGET_MAX, MATCH_TARGET_MIN, SCORING_MODES, theme } from '@partybox/cambio';
import type { OptionField } from '../options';

/** Cambio's host options for the TV lobby, in the order they are shown. */
export const cambioOptionFields: OptionField[] = [
  {
    key: 'scoringMode',
    kind: 'choice',
    ...theme.options.scoringMode,
    choices: SCORING_MODES.map((mode) => ({ value: mode, label: theme.scoringModes[mode].name })),
  },
  {
    key: 'matchTarget',
    kind: 'integer',
    ...theme.options.matchTarget,
    min: MATCH_TARGET_MIN,
    max: MATCH_TARGET_MAX,
    step: 10,
    visibleWhen: (values) => values.scoringMode === 'match',
  },
  { key: 'lockCaller', kind: 'boolean', ...theme.options.lockCaller },
  { key: 'rememberPeeks', kind: 'boolean', ...theme.options.rememberPeeks },
];
