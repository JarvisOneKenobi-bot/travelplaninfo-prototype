import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/server-config', () => ({
  getAnthropicApiKey: vi.fn(),
  getFastApiBaseUrl: vi.fn(),
}));

import { getAnthropicApiKey, getFastApiBaseUrl } from '@/lib/server-config';
import { getAssistantHealth, __resetAssistantHealthCacheForTests } from './assistant-health';

const mockAnthropicKey = vi.mocked(getAnthropicApiKey);
const mockFastApiUrl = vi.mocked(getFastApiBaseUrl);

function mockFetchOnce(impl: () => Promise<Response> | never) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

beforeEach(() => {
  __resetAssistantHealthCacheForTests();
  mockAnthropicKey.mockReturnValue('«redacted:sk-…»');
  mockFastApiUrl.mockReturnValue('http://localhost:8766');
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getAssistantHealth', () => {
  it('is healthy when the anthropic key is present and the backend responds', async () => {
    mockFetchOnce(() => Promise.resolve(new Response('ok', { status: 200 })));
    const result = await getAssistantHealth();
    expect(result).toEqual({
      anthropic: true,
      travelpayouts: false,
      backendReachable: true,
      healthy: true,
    });
  });

  it('is unhealthy when the anthropic key is missing, even if the backend responds', async () => {
    mockAnthropicKey.mockReturnValue('');
    mockFetchOnce(() => Promise.resolve(new Response('ok', { status: 200 })));
    const result = await getAssistantHealth();
    expect(result.anthropic).toBe(false);
    expect(result.backendReachable).toBe(true);
    expect(result.healthy).toBe(false);
  });

  it('is unhealthy when the backend probe rejects (connection refused)', async () => {
    mockFetchOnce(() => Promise.reject(new Error('ECONNREFUSED')));
    const result = await getAssistantHealth();
    expect(result.backendReachable).toBe(false);
    expect(result.healthy).toBe(false);
  });

  it('treats any HTTP response, even non-2xx, as reachable', async () => {
    mockFetchOnce(() => Promise.resolve(new Response('degraded', { status: 503 })));
    const result = await getAssistantHealth();
    expect(result.backendReachable).toBe(true);
  });

  it('reports travelpayouts independently of the healthy gate', async () => {
    vi.stubEnv('TRAVELPAYOUTS_TOKEN', 'fake-token');
    mockFetchOnce(() => Promise.reject(new Error('down')));
    const result = await getAssistantHealth();
    expect(result.travelpayouts).toBe(true);
    expect(result.healthy).toBe(false);
  });

  it('caches the result and does not re-probe within the TTL', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('ok', { status: 200 })));
    vi.stubGlobal('fetch', fetchSpy);
    await getAssistantHealth();
    await getAssistantHealth();
    await getAssistantHealth();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('single-flights concurrent calls made before the first resolves', async () => {
    let resolveFetch: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    const fetchSpy = vi.fn(() => pending);
    vi.stubGlobal('fetch', fetchSpy);

    const [a, b, c] = [getAssistantHealth(), getAssistantHealth(), getAssistantHealth()];
    resolveFetch!(new Response('ok', { status: 200 }));
    const results = await Promise.all([a, b, c]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });
});
