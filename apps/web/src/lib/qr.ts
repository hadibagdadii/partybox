import QRCode from 'qrcode';

/** Light modules around the code; the QR spec asks for at least 4. */
export const QUIET_ZONE = 4;

export interface QrMatrix {
  /** Modules per side, quiet zone excluded. */
  size: number;
  dark: (x: number, y: number) => boolean;
}

/** The module grid for `text`. Pure JS: no canvas, no network. */
export function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: modules.size, dark: (x, y) => !!modules.get(y, x) };
}

/** One SVG path drawing every dark module, offset by the quiet zone. */
export function qrPath({ size, dark }: QrMatrix): string {
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dark(x, y)) d += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return d;
}
