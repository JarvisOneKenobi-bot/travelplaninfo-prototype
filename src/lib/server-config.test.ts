import { describe, it, expect } from 'vitest';
import { getAnthropicApiKey, normalizeBaseUrl } from './server-config';

describe('server-config', () => {
  it('imports without throwing despite the server-only guard', () => {
    expect(typeof getAnthropicApiKey()).toBe('string');
  });

  it('normalizeBaseUrl strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizeBaseUrl('https://example.com///')).toBe('https://example.com');
  });
});
