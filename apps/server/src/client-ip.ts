/**
 * The client's IP, trusting the last `hops` proxies the way Express's numeric
 * `trust proxy` does: walk X-Forwarded-For from the right, one entry per trusted hop.
 * `trustedHeader` is the value of a header a proxy overwrites with the client IP
 * (CLIENT_IP_HEADER, e.g. CF-Connecting-IP); when present it wins.
 */
export function clientIp(
  forwardedFor: string | string[] | undefined,
  remoteAddress: string | undefined,
  hops: number,
  trustedHeader?: string | string[],
): string {
  const trusted = (Array.isArray(trustedHeader) ? trustedHeader[0] : trustedHeader)?.trim();
  if (trusted) return normalize(trusted);
  const header = Array.isArray(forwardedFor) ? forwardedFor.join(',') : (forwardedFor ?? '');
  const forwarded = header
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .reverse();
  const chain = [remoteAddress ?? 'unknown', ...forwarded];
  return normalize(chain[Math.min(hops, chain.length - 1)]!);
}

function normalize(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}
