import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './App';

function renderAt(path: string) {
  render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppRoutes />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('AppRoutes', () => {
  it('renders the landing page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Partybox' })).toBeTruthy();
  });

  it('renders the host placeholder at /host', () => {
    renderAt('/host');
    expect(screen.getByRole('heading', { name: 'Host screen' })).toBeTruthy();
  });

  it('renders the player placeholder at /play', () => {
    renderAt('/play');
    expect(screen.getByRole('heading', { name: 'Join a game' })).toBeTruthy();
  });
});
