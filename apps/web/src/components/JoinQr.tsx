import { useMemo } from 'react';
import { QUIET_ZONE, qrMatrix, qrPath } from '../lib/qr';

/** Dark-on-light QR for `url`, drawn as inline SVG so it needs no network or CSP change. */
export function JoinQr({ url, className }: { url: string; className?: string }) {
  const { side, d } = useMemo(() => {
    const matrix = qrMatrix(url);
    return { side: matrix.size + QUIET_ZONE * 2, d: qrPath(matrix) };
  }, [url]);
  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Scan to join"
      data-testid="join-qr"
      data-url={url}
      className={className}
    >
      <rect width={side} height={side} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
