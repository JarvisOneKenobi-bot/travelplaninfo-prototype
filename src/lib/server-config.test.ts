import { describe, it, expect } from 'vitest';
import { getFastApiBaseUrl, getAnthropicApiKey, normalizeBaseUrl } from './server-config';

describe('server-config', () => {
  it('imports without throwing despite the server-only guard', () => {
    expect(typeof getFastApiBaseUrl()).toBe('string');
    expect(typeof getAnthropicApiKey()).toBe('string');
  });

  it('normalizeBaseUrl strips trailing slashes', () => {
    expect(normalizeBaseUrl('http://localhost:8766/')).toBe('http://localhost:8766');
    expect(normalizeBaseUrl('http://localhost:8766///')).toBe('http://localhost:8766');
  });
});
