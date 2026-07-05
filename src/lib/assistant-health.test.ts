import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/server-config', () => ({
  getAnthropicApiKey: vi.fn(),
}));

vi.mock('./atlas/spend', () => ({
  ASSISTANT_SPEND_CAP_USD: 10,
  getAssistantMonthlySpendUsd: vi.fn(),
}));

import { getAnthropicApiKey } from '@/lib/server-config';
import { getAssistantMonthlySpendUsd, ASSISTANT_SPEND_CAP_USD } from './atlas/spend';
import { getAssistantHealth, __resetAssistantHealthCacheForTests } from './assistant-health';

const mockAnthropicKey = vi.mocked(getAnthropicApiKey);
const mockMonthlySpend = vi.mocked(getAssistantMonthlySpendUsd);

beforeEach(() => {
  __resetAssistantHealthCacheForTests();
  vi.clearAllMocks();
  mockAnthropicKey.mockReturnValue('«redacted:sk-…»');
  mockMonthlySpend.mockReturnValue(0);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('getAssistantHealth', () => {
  it('is healthy when the anthropic key is present and monthly spend is under the cap', async () => {
    mockMonthlySpend.mockReturnValue(ASSISTANT_SPEND_CAP_USD - 0.01);
    const result = await getAssistantHealth();
    expect(result).toEqual({
      anthropic: true,
      travelpayouts: false,
      spendCapOk: true,
      healthy: true,
    });
  });

  it('is unhealthy when the anthropic key is missing, even if monthly spend is under the cap', async () => {
    mockAnthropicKey.mockReturnValue('');
    mockMonthlySpend.mockReturnValue(ASSISTANT_SPEND_CAP_USD - 0.01);
    const result = await getAssistantHealth();
    expect(result.anthropic).toBe(false);
    expect(result.spendCapOk).toBe(true);
    expect(result.healthy).toBe(false);
  });

  it('is unhealthy when monthly spend is at the cap', async () => {
    mockMonthlySpend.mockReturnValue(ASSISTANT_SPEND_CAP_USD);
    const result = await getAssistantHealth();
    expect(result.spendCapOk).toBe(false);
    expect(result.healthy).toBe(false);
  });

  it('is unhealthy when monthly spend is over the cap', async () => {
    mockMonthlySpend.mockReturnValue(ASSISTANT_SPEND_CAP_USD + 0.01);
    const result = await getAssistantHealth();
    expect(result.spendCapOk).toBe(false);
    expect(result.healthy).toBe(false);
  });

  it('reports travelpayouts independently of the healthy gate', async () => {
    vi.stubEnv('TRAVELPAYOUTS_TOKEN', 'fake-token');
    mockMonthlySpend.mockReturnValue(ASSISTANT_SPEND_CAP_USD);
    const result = await getAssistantHealth();
    expect(result.travelpayouts).toBe(true);
    expect(result.healthy).toBe(false);
  });

  it('caches the result and does not re-read spend within the TTL', async () => {
    await getAssistantHealth();
    await getAssistantHealth();
    await getAssistantHealth();
    expect(mockMonthlySpend).toHaveBeenCalledTimes(1);
  });

  it('single-flights concurrent calls made before the first resolves', async () => {
    const [a, b, c] = [getAssistantHealth(), getAssistantHealth(), getAssistantHealth()];
    const results = await Promise.all([a, b, c]);

    expect(mockMonthlySpend).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });
});
