import jsQR from 'jsqr';

/** Rasterizes a JoinQr <svg> (white field, `M x y h1v1h-1z` modules) and decodes it like a camera would. */
export function decodeQrSvg(svg: Element, scale = 8): string | null {
  const side = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
  const d = svg.querySelector('path')!.getAttribute('d')!;
  const px = side * scale;
  const rgba = new Uint8ClampedArray(px * px * 4).fill(255);
  for (const [, xs, ys] of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const mx = Number(xs);
    const my = Number(ys);
    for (let y = my * scale; y < (my + 1) * scale; y++) {
      for (let x = mx * scale; x < (mx + 1) * scale; x++) {
        const i = (y * px + x) * 4;
        rgba[i] = rgba[i + 1] = rgba[i + 2] = 0;
      }
    }
  }
  return jsQR(rgba, px, px)?.data ?? null;
}
