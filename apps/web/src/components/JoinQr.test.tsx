import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QUIET_ZONE, qrMatrix } from '../lib/qr';
import { joinUrl } from '../lib/room-code';
import { decodeQrSvg } from '../test/decode-qr';
import { JoinQr } from './JoinQr';

afterEach(cleanup);

describe('JoinQr', () => {
  it('encodes the exact join URL for the room', () => {
    const url = joinUrl('BCDF');
    expect(url).toBe(`${window.location.origin}/play?code=BCDF`);
    render(<JoinQr url={url} />);
    expect(decodeQrSvg(screen.getByRole('img', { name: 'Scan to join' }))).toBe(url);
  });

  it('draws dark modules on a light field with a 4-module quiet zone', () => {
    const url = joinUrl('BCDF');
    render(<JoinQr url={url} />);
    const svg = screen.getByTestId('join-qr');
    const side = qrMatrix(url).size + QUIET_ZONE * 2;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${side} ${side}`);
    expect(svg.querySelector('rect')!.getAttribute('fill')).toBe('#fff');
    expect(svg.querySelector('path')!.getAttribute('fill')).toBe('#000');
    const coords = [
      ...svg
        .querySelector('path')!
        .getAttribute('d')!
        .matchAll(/M(\d+) (\d+)/g),
    ];
    const all = coords.flatMap(([, x, y]) => [Number(x), Number(y)]);
    expect(Math.min(...all)).toBe(QUIET_ZONE);
    expect(Math.max(...all)).toBe(side - QUIET_ZONE - 1);
  });
});
