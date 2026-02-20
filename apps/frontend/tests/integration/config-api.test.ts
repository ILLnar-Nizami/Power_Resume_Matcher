import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchLlmConfig,
  fetchLlmApiKey,
  updateLlmConfig,
  updateLlmApiKey,
  testLlmConnection,
  fetchSystemStatus,
  fetchFeatureConfig,
  updateFeatureConfig,
  fetchLanguageConfig,
  updateLanguageConfig,
  fetchPromptConfig,
  updatePromptConfig,
  fetchApiKeyStatus,
  updateApiKeys,
  deleteApiKey,
  clearAllApiKeys,
  resetDatabase,
  PROVIDER_INFO,
  API_KEY_PROVIDER_INFO,
} from '@/lib/api/config';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual('@/lib/api/client');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

import { apiFetch } from '@/lib/api/client';

describe('Config API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchLlmConfig', () => {
    it('fetches LLM config successfully', async () => {
      const mockConfig = {
        provider: 'openai',
        model: 'gpt-4',
        api_key: 'sk-test',
        api_base: null,
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await fetchLlmConfig();
      expect(result.provider).toBe('openai');
      expect(apiFetch).toHaveBeenCalledWith('/config/llm-api-key', { credentials: 'include' });
    });

    it('throws on failed fetch', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(fetchLlmConfig()).rejects.toThrow('Failed to load LLM config');
    });
  });

  describe('fetchLlmApiKey', () => {
    it('returns api_key from config', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ provider: 'openai', api_key: 'sk-test' }),
      } as any);

      const result = await fetchLlmApiKey();
      expect(result).toBe('sk-test');
    });

    it('returns empty string when no api_key', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ provider: 'openai', api_key: null }),
      } as any);

      const result = await fetchLlmApiKey();
      expect(result).toBe('');
    });
  });

  describe('updateLlmConfig', () => {
    it('updates LLM config successfully', async () => {
      const mockConfig = {
        provider: 'anthropic' as const,
        model: 'claude-3',
        api_key: 'sk-anthropic',
        api_base: null,
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await updateLlmConfig({ provider: 'anthropic', model: 'claude-3' });
      expect(result.provider).toBe('anthropic');
    });

    it('throws on failed update', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Invalid config' }),
      } as any);

      await expect(updateLlmConfig({ provider: 'invalid' as any })).rejects.toThrow('Invalid config');
    });

    it('throws generic error when no detail', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as any);

      await expect(updateLlmConfig({ api_key: 'test' })).rejects.toThrow('Failed to update LLM config');
    });
  });

  describe('updateLlmApiKey', () => {
    it('updates api_key and returns it', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ api_key: 'sk-new' }),
      } as any);

      const result = await updateLlmApiKey('sk-new');
      expect(result).toBe('sk-new');
    });
  });

  describe('testLlmConnection', () => {
    it('tests connection without config', async () => {
      const mockResult = { healthy: true, provider: 'openai', model: 'gpt-4' };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      } as any);

      const result = await testLlmConnection();
      expect(result.healthy).toBe(true);
    });

    it('tests connection with config', async () => {
      const mockResult = { healthy: true, provider: 'anthropic', model: 'claude-3' };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      } as any);

      const result = await testLlmConnection({ provider: 'anthropic', api_key: 'sk-test' });
      expect(result.provider).toBe('anthropic');
    });

    it('throws on failed test', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(testLlmConnection()).rejects.toThrow('Failed to test LLM connection');
    });
  });

  describe('fetchSystemStatus', () => {
    it('fetches system status', async () => {
      const mockStatus = {
        status: 'ready' as const,
        llm_configured: true,
        llm_healthy: true,
        has_master_resume: false,
        database_stats: { total_resumes: 5, total_jobs: 3, total_improvements: 10, has_master_resume: false },
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      } as any);

      const result = await fetchSystemStatus();
      expect(result.status).toBe('ready');
      expect(result.llm_configured).toBe(true);
    });

    it('throws on failed fetch', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 503,
      } as any);

      await expect(fetchSystemStatus()).rejects.toThrow('Failed to fetch system status');
    });
  });

  describe('fetchFeatureConfig', () => {
    it('fetches feature config', async () => {
      const mockConfig = { enable_cover_letter: true, enable_outreach_message: true };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await fetchFeatureConfig();
      expect(result.enable_cover_letter).toBe(true);
    });

    it('throws on failed fetch', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(fetchFeatureConfig()).rejects.toThrow('Failed to load feature config');
    });
  });

  describe('updateFeatureConfig', () => {
    it('updates feature config', async () => {
      const mockConfig = { enable_cover_letter: false, enable_outreach_message: true };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await updateFeatureConfig({ enable_cover_letter: false });
      expect(result.enable_cover_letter).toBe(false);
    });

    it('throws on failed update with detail', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Invalid feature' }),
      } as any);

      await expect(updateFeatureConfig({} as any)).rejects.toThrow('Invalid feature');
    });
  });

  describe('fetchLanguageConfig', () => {
    it('fetches language config', async () => {
      const mockConfig = {
        ui_language: 'en' as const,
        content_language: 'en' as const,
        supported_languages: ['en', 'es', 'zh'],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await fetchLanguageConfig();
      expect(result.ui_language).toBe('en');
    });

    it('throws on failed fetch', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      await expect(fetchLanguageConfig()).rejects.toThrow('Failed to load language config');
    });
  });

  describe('updateLanguageConfig', () => {
    it('updates language config', async () => {
      const mockConfig = {
        ui_language: 'es' as const,
        content_language: 'es' as const,
        supported_languages: ['en', 'es'],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await updateLanguageConfig({ ui_language: 'es' });
      expect(result.ui_language).toBe('es');
    });
  });

  describe('fetchPromptConfig', () => {
    it('fetches prompt config', async () => {
      const mockConfig = {
        default_prompt_id: 'default',
        prompt_options: [
          { id: 'default', label: 'Default', description: 'Default prompt' },
        ],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await fetchPromptConfig();
      expect(result.default_prompt_id).toBe('default');
    });
  });

  describe('updatePromptConfig', () => {
    it('updates prompt config', async () => {
      const mockConfig = {
        default_prompt_id: 'custom',
        prompt_options: [],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as any);

      const result = await updatePromptConfig({ default_prompt_id: 'custom' });
      expect(result.default_prompt_id).toBe('custom');
    });
  });

  describe('fetchApiKeyStatus', () => {
    it('fetches API key status', async () => {
      const mockResponse = {
        providers: [
          { provider: 'openai', configured: true, masked_key: 'sk-***1234' },
          { provider: 'anthropic', configured: false, masked_key: null },
        ],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await fetchApiKeyStatus();
      expect(result.providers).toHaveLength(2);
      expect(result.providers[0].configured).toBe(true);
    });
  });

  describe('updateApiKeys', () => {
    it('updates API keys', async () => {
      const mockResponse = { message: 'Keys updated', updated_providers: ['openai'] };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await updateApiKeys({ openai: 'sk-new' });
      expect(result.updated_providers).toContain('openai');
    });

    it('throws on failed update', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Invalid key' }),
      } as any);

      await expect(updateApiKeys({ openai: 'invalid' })).rejects.toThrow('Invalid key');
    });
  });

  describe('deleteApiKey', () => {
    it('deletes API key', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as any);

      await expect(deleteApiKey('openai' as any)).resolves.not.toThrow();
    });

    it('throws on failed delete', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Cannot delete' }),
      } as any);

      await expect(deleteApiKey('openai' as any)).rejects.toThrow('Cannot delete');
    });
  });

  describe('clearAllApiKeys', () => {
    it('clears all API keys', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      } as any);

      await expect(clearAllApiKeys()).resolves.not.toThrow();
    });
  });

  describe('resetDatabase', () => {
    it('resets database', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      } as any);

      await expect(resetDatabase()).resolves.not.toThrow();
    });

    it('throws on failed reset', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Confirmation required' }),
      } as any);

      await expect(resetDatabase()).rejects.toThrow('Confirmation required');
    });
  });

  describe('PROVIDER_INFO', () => {
    it('contains all providers', () => {
      expect(PROVIDER_INFO.openai).toBeDefined();
      expect(PROVIDER_INFO.anthropic).toBeDefined();
      expect(PROVIDER_INFO.openrouter).toBeDefined();
      expect(PROVIDER_INFO.gemini).toBeDefined();
      expect(PROVIDER_INFO.deepseek).toBeDefined();
      expect(PROVIDER_INFO.ollama).toBeDefined();
      expect(PROVIDER_INFO.cerebras).toBeDefined();
    });

    it('has correct requiresKey values', () => {
      expect(PROVIDER_INFO.openai.requiresKey).toBe(true);
      expect(PROVIDER_INFO.ollama.requiresKey).toBe(false);
    });
  });

  describe('API_KEY_PROVIDER_INFO', () => {
    it('contains all API key providers', () => {
      expect(API_KEY_PROVIDER_INFO.openai).toBeDefined();
      expect(API_KEY_PROVIDER_INFO.anthropic).toBeDefined();
      expect(API_KEY_PROVIDER_INFO.google).toBeDefined();
    });
  });
});
