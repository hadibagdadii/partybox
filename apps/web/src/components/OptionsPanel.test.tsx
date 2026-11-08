import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OptionField } from '../games/options';
import { OptionsPanel } from './OptionsPanel';

afterEach(cleanup);

const fields: OptionField[] = [
  {
    key: 'mode',
    kind: 'choice',
    label: 'Mode',
    choices: [
      { value: 'one', label: 'One' },
      { value: 'many', label: 'Many' },
    ],
  },
  {
    key: 'target',
    kind: 'integer',
    label: 'Target',
    min: 10,
    max: 50,
    step: 10,
    visibleWhen: (v) => v.mode === 'many',
  },
  { key: 'locked', kind: 'boolean', label: 'Locked', hint: 'Keep it shut.' },
];

function panel(values: Record<string, unknown>) {
  const onChange = vi.fn();
  render(<OptionsPanel fields={fields} values={values} onChange={onChange} />);
  return onChange;
}

describe('OptionsPanel', () => {
  it('draws each kind of field and sends one change at a time', () => {
    const onChange = panel({ mode: 'one', target: 20, locked: false });
    expect(screen.getByRole('radio', { name: 'One' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText('Target')).toBeNull();
    expect(screen.getByText('Keep it shut.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Many' }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: 'many' });
    fireEvent.click(screen.getByRole('switch', { name: 'Locked' }));
    expect(onChange).toHaveBeenLastCalledWith({ locked: true });
  });

  it('steps and clamps whole numbers', () => {
    const onChange = panel({ mode: 'many', target: 50, locked: true });
    expect((screen.getByRole('button', { name: 'Target up' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Target down' }));
    expect(onChange).toHaveBeenLastCalledWith({ target: 40 });
    // A second tap before the server answers counts from the first.
    fireEvent.click(screen.getByRole('button', { name: 'Target down' }));
    expect(onChange).toHaveBeenLastCalledWith({ target: 30 });
    const input = screen.getByRole('spinbutton', { name: 'Target' });
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith({ target: 10 });
  });
});
