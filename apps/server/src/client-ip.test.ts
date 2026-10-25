import { describe, expect, it } from 'vitest';
import { clientIp } from './client-ip.js';

describe('clientIp', () => {
  it('uses the socket address when no proxy is trusted', () => {
    expect(clientIp('203.0.113.9', '10.0.0.2', 0)).toBe('10.0.0.2');
    expect(clientIp(undefined, '::ffff:127.0.0.1', 0)).toBe('127.0.0.1');
  });

  it('takes the entry the trusted proxy appended', () => {
    expect(clientIp('203.0.113.9', '10.0.0.2', 1)).toBe('203.0.113.9');
  });

  it('ignores entries a client spoofed in front of the real one', () => {
    expect(clientIp('6.6.6.6, 203.0.113.9', '10.0.0.2', 1)).toBe('203.0.113.9');
    expect(clientIp(['6.6.6.6', '203.0.113.9'], '10.0.0.2', 1)).toBe('203.0.113.9');
  });

  it('walks back one entry per extra hop', () => {
    expect(clientIp('203.0.113.9, 10.1.1.1', '10.0.0.2', 2)).toBe('203.0.113.9');
  });

  it('stops at the leftmost entry when the chain is shorter than the hop count', () => {
    expect(clientIp('203.0.113.9', '10.0.0.2', 3)).toBe('203.0.113.9');
    expect(clientIp(undefined, '10.0.0.2', 2)).toBe('10.0.0.2');
  });
});
