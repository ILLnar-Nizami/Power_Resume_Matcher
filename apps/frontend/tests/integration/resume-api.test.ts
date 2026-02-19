import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadJobDescriptions,
  improveResume,
  previewImproveResume,
  confirmImproveResume,
  fetchResume,
  fetchResumeList,
  updateResume,
  deleteResume,
  getResumePdfUrl,
  renameResume,
  updateCoverLetter,
  updateOutreachMessage,
  getCoverLetterPdfUrl,
  generateCoverLetter,
  generateOutreachMessage,
  retryProcessing,
  fetchJobDescription,
  downloadResumePdf,
  downloadCoverLetterPdf,
} from '@/lib/api/resume';

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual('@/lib/api/client');
  return {
    ...actual,
    API_BASE: 'http://localhost:8890/api/v1',
    apiFetch: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
  };
});

import { API_BASE, apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client';

describe('Resume API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchResume', () => {
    it('fetches resume by ID and returns data', async () => {
      const mockData = {
        data: {
          resume_id: 'res-123',
          title: 'Test Resume',
        },
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as any);

      const result = await fetchResume('res-123');
      expect(result.resume_id).toBe('res-123');
      expect(apiFetch).toHaveBeenCalledWith('/resumes?resume_id=res-123');
    });

    it('throws error on failed fetch', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      await expect(fetchResume('invalid')).rejects.toThrow('Failed to load resume');
    });
  });

  describe('fetchResumeList', () => {
    it('fetches resume list', async () => {
      const mockData = {
        data: [
          { resume_id: '1', title: 'Resume 1' },
          { resume_id: '2', title: 'Resume 2' },
        ],
      };
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as any);

      const result = await fetchResumeList();
      expect(result).toHaveLength(2);
    });

    it('fetches resume list with master flag', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      } as any);

      await fetchResumeList(true);
      expect(apiFetch).toHaveBeenCalledWith('/resumes/list?include_master=true');
    });
  });

  describe('updateResume', () => {
    it('updates resume with patch request', async () => {
      const mockData = { data: { resume_id: 'res-123', title: 'Updated' } };
      (apiPatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        text: () => Promise.resolve(''),
      } as any);

      const result = await updateResume('res-123', { personalInfo: { name: 'John' } } as any);
      expect(result.resume_id).toBe('res-123');
    });

    it('throws on failed update', async () => {
      (apiPatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as any);

      await expect(updateResume('res-123', {} as any)).rejects.toThrow('Failed to update resume');
    });
  });

  describe('deleteResume', () => {
    it('deletes resume successfully', async () => {
      (apiDelete as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
      } as any);

      await expect(deleteResume('res-123')).resolves.not.toThrow();
    });

    it('throws on failed delete', async () => {
      (apiDelete as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      } as any);

      await expect(deleteResume('res-123')).rejects.toThrow('Failed to delete resume');
    });
  });

  describe('getResumePdfUrl', () => {
    it('generates PDF URL with default settings', () => {
      const url = getResumePdfUrl('res-123');
      expect(url).toContain('/resumes/res-123/pdf');
      expect(url).toContain('template=swiss-single');
      expect(url).toContain('pageSize=A4');
    });

    it('generates PDF URL with custom settings', () => {
      const url = getResumePdfUrl('res-123', {
        template: 'modern',
        pageSize: 'LETTER',
        margins: { top: 1, bottom: 1, left: 1, right: 1 },
        spacing: { section: 2, item: 1, lineHeight: 1.5 },
        fontSize: { base: 12, headerScale: 1.5, headerFont: 'Arial', bodyFont: 'Arial' },
        compactMode: true,
        showContactIcons: false,
        accentColor: '#FF0000',
      });
      expect(url).toContain('template=modern');
      expect(url).toContain('pageSize=LETTER');
      expect(url).toContain('compactMode=true');
    });

    it('throws on empty resume ID', () => {
      expect(() => getResumePdfUrl('')).toThrow('Resume ID is required');
    });
  });

  describe('renameResume', () => {
    it('renames resume', async () => {
      (apiPatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(''),
      } as any);

      await renameResume('res-123', 'New Title');
      expect(apiPatch).toHaveBeenCalled();
    });
  });

  describe('updateCoverLetter', () => {
    it('updates cover letter', async () => {
      (apiPatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(''),
      } as any);

      await updateCoverLetter('res-123', 'Cover letter content');
      expect(apiPatch).toHaveBeenCalled();
    });
  });

  describe('updateOutreachMessage', () => {
    it('updates outreach message', async () => {
      (apiPatch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(''),
      } as any);

      await updateOutreachMessage('res-123', 'Outreach message');
      expect(apiPatch).toHaveBeenCalled();
    });
  });

  describe('generateCoverLetter', () => {
    it('generates cover letter', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: 'Generated letter' }),
      } as any);

      const result = await generateCoverLetter('res-123');
      expect(result).toBe('Generated letter');
    });
  });

  describe('generateOutreachMessage', () => {
    it('generates outreach message', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content: 'Generated message' }),
      } as any);

      const result = await generateOutreachMessage('res-123');
      expect(result).toBe('Generated message');
    });
  });

  describe('getCoverLetterPdfUrl', () => {
    it('generates cover letter PDF URL', () => {
      const url = getCoverLetterPdfUrl('res-123');
      expect(url).toContain('/cover-letter/pdf');
      expect(url).toContain('pageSize=A4');
    });

    it('accepts custom page size', () => {
      const url = getCoverLetterPdfUrl('res-123', 'LETTER');
      expect(url).toContain('pageSize=LETTER');
    });

    it('accepts locale parameter', () => {
      const url = getCoverLetterPdfUrl('res-123', 'A4', 'en');
      expect(url).toContain('lang=en');
    });
  });

  describe('downloadResumePdf', () => {
    it('downloads resume PDF', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({ 'content-disposition': 'filename="cv_test_12.02.26.pdf"' }),
      } as any);

      const result = await downloadResumePdf('res-123');
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toBe('cv_test_12.02.26.pdf');
    });

    it('throws on download failure', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as any);

      await expect(downloadResumePdf('res-123')).rejects.toThrow('Failed to download resume');
    });
  });

  describe('downloadCoverLetterPdf', () => {
    it('downloads cover letter PDF', async () => {
      const mockBlob = new Blob(['PDF content'], { type: 'application/pdf' });
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({ 'content-disposition': 'filename="cl_test_12.02.26.pdf"' }),
      } as any);

      const result = await downloadCoverLetterPdf('res-123');
      expect(result).toHaveProperty('blob');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toBe('cl_test_12.02.26.pdf');
    });
  });

  describe('generateCoverLetter errors', () => {
    it('throws on generation failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Generation failed'),
      } as any);

      await expect(generateCoverLetter('res-123')).rejects.toThrow('Failed to generate cover letter');
    });
  });

  describe('generateOutreachMessage errors', () => {
    it('throws on generation failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Generation failed'),
      } as any);

      await expect(generateOutreachMessage('res-123')).rejects.toThrow('Failed to generate outreach message');
    });
  });

  describe('retryProcessing', () => {
    it('retries processing', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ processing_status: 'processing' }),
      } as any);

      const result = await retryProcessing('res-123');
      expect(result.processing_status).toBe('processing');
    });
  });

  describe('fetchJobDescription', () => {
    it('fetches job description', async () => {
      (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ job_id: 'job-123', content: 'JD content' }),
      } as any);

      const result = await fetchJobDescription('res-123');
      expect(result.job_id).toBe('job-123');
    });
  });
});

describe('Job Description API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadJobDescriptions', () => {
    it('uploads job descriptions and returns job ID', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ job_id: ['job-123'] }),
      } as any);

      const result = await uploadJobDescriptions(['JD content'], 'res-123');
      expect(result).toBe('job-123');
    });

    it('throws on upload failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
      } as any);

      await expect(uploadJobDescriptions(['JD'], 'res-123')).rejects.toThrow('Upload failed');
    });
  });
});

describe('Tailor/Improve API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('improveResume', () => {
    it('calls improve endpoint', async () => {
      const mockResponse = {
        data: {
          resume_id: 'res-123',
          improved_data: {},
        },
      };
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as any);

      const result = await improveResume('res-123', 'job-123');
      expect(result.data.resume_id).toBe('res-123');
    });

    it('throws on improve failure', async () => {
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal error'),
      } as any);

      await expect(improveResume('res-123', 'job-123')).rejects.toThrow();
    });
  });

  describe('previewImproveResume', () => {
    it('calls preview endpoint', async () => {
      const mockResponse = { data: { resume_id: 'res-123' } };
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as any);

      const result = await previewImproveResume('res-123', 'job-123');
      expect(result.data.resume_id).toBe('res-123');
    });
  });

  describe('confirmImproveResume', () => {
    it('confirms improvement', async () => {
      const mockResponse = { data: { resume_id: 'res-123' } };
      (apiPost as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as any);

      const payload = {
        resume_id: 'res-123',
        job_id: 'job-123',
        improved_data: {} as any,
        improvements: [],
      };

      const result = await confirmImproveResume(payload);
      expect(result.data.resume_id).toBe('res-123');
    });
  });
});
