import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  analyzeResume,
  generateEnhancements,
  applyEnhancements,
  regenerateItems,
  applyRegeneratedItems,
} from '@/lib/api/enrichment';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual('@/lib/api/client');
  return {
    ...actual,
    API_BASE: 'http://localhost:8890/api/v1',
    apiFetch: vi.fn(),
    apiPost: vi.fn(),
  };
});

import { API_BASE, apiFetch, apiPost } from '@/lib/api/client';

describe('Enrichment API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeResume', () => {
    it('analyzes resume and returns enrichment items', async () => {
      const mockResponse = {
        items_to_enrich: [
          {
            item_id: 'exp_1',
            item_type: 'experience',
            title: 'Software Engineer',
            subtitle: 'Tech Corp',
            current_description: ['Did things'],
            weakness_reason: 'Too generic',
          },
        ],
        questions: [
          {
            question_id: 'q1',
            item_id: 'exp_1',
            question: 'What was your biggest achievement?',
            placeholder: 'Describe it...',
          },
        ],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await analyzeResume('res-123');
      expect(result.items_to_enrich).toHaveLength(1);
      expect(result.questions).toHaveLength(1);
      expect(result.items_to_enrich[0].item_id).toBe('exp_1');
    });

    it('throws on analysis failure', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Failed to analyze' }),
      } as any);

      await expect(analyzeResume('res-123')).rejects.toThrow();
    });

    it('handles empty analysis result', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items_to_enrich: [], questions: [] }),
      } as any);

      const result = await analyzeResume('res-123');
      expect(result.items_to_enrich).toHaveLength(0);
      expect(result.questions).toHaveLength(0);
    });
  });

  describe('generateEnhancements', () => {
    it('generates enhanced descriptions', async () => {
      const mockResponse = {
        enhancements: [
          {
            item_id: 'exp_1',
            item_type: 'experience',
            title: 'Engineer',
            original_description: ['Old'],
            enhanced_description: ['New improved description'],
          },
        ],
      };
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const answers = [
        { question_id: 'q1', answer: 'Led team of 5 engineers' },
      ];

      const result = await generateEnhancements('res-123', answers);
      expect(result.enhancements).toHaveLength(1);
      expect(result.enhancements[0].enhanced_description).toContain('New improved description');
    });

    it('throws on generation failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Failed to generate' }),
      } as any);

      await expect(generateEnhancements('res-123', [])).rejects.toThrow();
    });
  });

  describe('applyEnhancements', () => {
    it('applies enhancements to resume', async () => {
      const mockEnhancements = [
        {
          item_id: 'exp_1',
          item_type: 'experience' as const,
          title: 'Engineer',
          original_description: ['Old'],
          enhanced_description: ['New'],
        },
      ];
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Applied', updated_items: 1 }),
      } as any);

      const result = await applyEnhancements('res-123', mockEnhancements);
      expect(result.updated_items).toBe(1);
    });

    it('throws on apply failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Failed to apply' }),
      } as any);

      await expect(applyEnhancements('res-123', [])).rejects.toThrow();
    });
  });

  describe('regenerateItems', () => {
    it('regenerates resume items with AI', async () => {
      const mockResponse = {
        regenerated_items: [
          {
            item_id: 'exp_1',
            item_type: 'experience' as const,
            title: 'Software Engineer',
            subtitle: 'Tech Corp',
            original_content: ['Old content'],
            new_content: ['New improved content'],
            diff_summary: 'Added action verbs',
          },
        ],
      };
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const items = [
        {
          item_id: 'exp_1',
          item_type: 'experience' as const,
          title: 'Software Engineer',
          subtitle: 'Tech Corp',
          current_content: ['Old content'],
        },
      ];

      const result = await regenerateItems({
        resume_id: 'res-123',
        items,
        instruction: 'Make it more impactful',
        output_language: 'en',
      });

      expect(result.regenerated_items).toHaveLength(1);
      expect(result.regenerated_items[0].new_content).toContain('New improved content');
    });

    it('handles regeneration errors', async () => {
      const mockResponse = {
        regenerated_items: [],
        errors: [
          {
            item_id: 'exp_1',
            item_type: 'experience' as const,
            title: 'Engineer',
            message: 'Could not regenerate',
          },
        ],
      };
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await regenerateItems({
        resume_id: 'res-123',
        items: [{ item_id: 'exp_1', item_type: 'experience', title: 'Engineer', current_content: [] }],
        instruction: 'test',
      });

      expect(result.errors).toHaveLength(1);
    });

    it('throws on critical failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Failed to regenerate' }),
      } as any);

      await expect(
        regenerateItems({
          resume_id: 'res-123',
          items: [],
          instruction: 'test',
        })
      ).rejects.toThrow();
    });
  });

  describe('applyRegeneratedItems', () => {
    it('applies regenerated items to resume', async () => {
      const mockItems = [
        {
          item_id: 'exp_1',
          item_type: 'experience' as const,
          title: 'Engineer',
          subtitle: 'Tech Corp',
          original_content: ['Old'],
          new_content: ['New'],
          diff_summary: 'Updated',
        },
      ];
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'Applied', updated_items: 1 }),
      } as any);

      const result = await applyRegeneratedItems('res-123', mockItems);
      expect(result.updated_items).toBe(1);
    });

    it('throws on apply failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Failed to apply changes' }),
      } as any);

      await expect(applyRegeneratedItems('res-123', [])).rejects.toThrow('Failed to apply changes');
    });
  });
});
