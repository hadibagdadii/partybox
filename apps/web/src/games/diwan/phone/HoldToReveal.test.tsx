import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HoldToReveal } from './HoldToReveal';

afterEach(cleanup);

function setup() {
  render(
    <HoldToReveal label="Hold to reveal" cover={<span>Sealed</span>}>
      <span>The Usurper</span>
    </HoldToReveal>,
  );
  return screen.getByRole('button', { name: 'Hold to reveal' });
}

describe('HoldToReveal', () => {
  it('is hidden by default', () => {
    setup();
    expect(screen.queryByText('The Usurper')).toBeNull();
    expect(screen.getByText('Sealed')).toBeTruthy();
  });

  it('shows the secret only while held, and hides it on release', () => {
    const button = setup();
    fireEvent.pointerDown(button);
    expect(screen.getByText('The Usurper')).toBeTruthy();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.pointerUp(button);
    expect(screen.queryByText('The Usurper')).toBeNull();
  });

  it('hides when the finger slides off or the touch is cancelled', () => {
    const button = setup();
    fireEvent.pointerDown(button);
    fireEvent.pointerLeave(button);
    expect(screen.queryByText('The Usurper')).toBeNull();
    fireEvent.pointerDown(button);
    fireEvent.pointerCancel(button);
    expect(screen.queryByText('The Usurper')).toBeNull();
  });

  it('hides when the release happens outside the button', () => {
    const button = setup();
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(window);
    expect(screen.queryByText('The Usurper')).toBeNull();
  });

  it('works with a held Space key', () => {
    const button = setup();
    fireEvent.keyDown(button, { key: ' ' });
    expect(screen.getByText('The Usurper')).toBeTruthy();
    fireEvent.keyUp(button, { key: ' ' });
    expect(screen.queryByText('The Usurper')).toBeNull();
  });
});

describe('HoldToReveal from the keyboard', () => {
  it('reveals while Enter is held, through key repeat, and hides on release', () => {
    const button = setup();
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyDown(button, { key: 'Enter', repeat: true });
    fireEvent.keyDown(button, { key: 'Enter', repeat: true });
    expect(screen.getByText('The Usurper')).toBeTruthy();
    fireEvent.keyUp(button, { key: 'Enter' });
    expect(screen.queryByText('The Usurper')).toBeNull();
  });

  it('ignores other keys and hides if focus leaves mid-hold', () => {
    const button = setup();
    fireEvent.keyDown(button, { key: 'a' });
    expect(screen.queryByText('The Usurper')).toBeNull();
    fireEvent.keyDown(button, { key: ' ' });
    expect(screen.getByText('The Usurper')).toBeTruthy();
    fireEvent.blur(button);
    expect(screen.queryByText('The Usurper')).toBeNull();
  });

  it('is focusable and blocks the long-press menu', () => {
    const button = setup();
    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.className).toContain('no-callout');
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    button.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
  });
});
