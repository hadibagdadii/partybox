import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DevCambioCards } from './DevCambioCards';

afterEach(cleanup);

describe('Cambio card gallery', () => {
  it('shows every face, the back, and a replay button for each primitive', () => {
    const { container } = render(
      <MemoryRouter>
        <DevCambioCards />
      </MemoryRouter>,
    );
    const faces = screen.getByTestId('faces');
    expect(faces.querySelectorAll('[data-face]')).toHaveLength(54);
    expect(faces.querySelectorAll('[data-back]').length).toBeGreaterThanOrEqual(1);
    const buttons = [...container.querySelectorAll('[data-primitive]')].map((b) =>
      b.getAttribute('data-primitive'),
    );
    for (const id of [
      'deal',
      'draw',
      'flip',
      'swap',
      'discard',
      'peekOwn',
      'blindSwap',
      'snap',
      'snapGive',
      'wrongSnap',
      'reshuffle',
      'reveal',
      'burst',
    ]) {
      expect(buttons).toContain(id);
    }
    fireEvent.click(screen.getByRole('button', { name: '12 players' }));
    expect(screen.getByRole('button', { name: '12 players' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
