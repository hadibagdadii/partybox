import { describe, expect, it } from 'vitest';
import { classifyGesture } from './gesture';

describe('classifyGesture', () => {
  it('needs at least 40 px up for a swipe', () => {
    expect(classifyGesture(0, -39)).toBe('none');
    expect(classifyGesture(0, -40)).toBe('swipe');
  });
  it('needs a mostly vertical swipe', () => {
    expect(classifyGesture(40, -60)).toBe('none');
    expect(classifyGesture(30, -60)).toBe('swipe');
    expect(classifyGesture(80, 0)).toBe('none');
    expect(classifyGesture(0, 60)).toBe('none');
  });
  it('treats a press that barely moves as a tap', () => {
    expect(classifyGesture(0, 0)).toBe('tap');
    expect(classifyGesture(6, -6)).toBe('tap');
    expect(classifyGesture(12, 0)).toBe('none');
  });
});
