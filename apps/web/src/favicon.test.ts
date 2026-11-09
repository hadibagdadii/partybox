import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const web = path.resolve(__dirname, '..');

describe('favicon', () => {
  it('ships an SVG favicon that index.html links, so no page asks for /favicon.ico', () => {
    const html = readFileSync(path.join(web, 'index.html'), 'utf8');
    expect(html).toMatch(/<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" \/>/);
    const icon = path.join(web, 'public', 'favicon.svg');
    expect(existsSync(icon)).toBe(true);
    expect(readFileSync(icon, 'utf8')).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });
});
