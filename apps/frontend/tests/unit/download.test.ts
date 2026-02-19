import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlobAsFile, openUrlInNewTab } from '@/lib/utils/download';

describe('downloadBlobAsFile', () => {
  beforeEach(() => {
    const mockLink = {
      click: vi.fn(),
      remove: vi.fn(),
      style: {},
      download: '',
      href: '',
    };
    
    vi.stubGlobal('document', {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn((tag: string) => {
        if (tag === 'a') return mockLink;
        return document.createElement(tag);
      }),
    });
    
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://test'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when document is undefined', () => {
    vi.stubGlobal('document', undefined);
    const blob = new Blob(['test'], { type: 'text/plain' });
    
    expect(() => downloadBlobAsFile(blob, 'test.txt')).not.toThrow();
  });

  it('creates download link and clicks it', () => {
    const blob = new Blob(['test content'], { type: 'text/plain' });
    downloadBlobAsFile(blob, 'test.txt');
    
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  });
});

describe('openUrlInNewTab', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      open: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    expect(openUrlInNewTab('https://example.com')).toBe(false);
  });

  it('opens URL in new tab', () => {
    const mockOpener = { opener: null };
    vi.stubGlobal('window', { open: vi.fn(() => mockOpener) });
    
    const result = openUrlInNewTab('https://example.com');
    
    expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
    expect(result).toBe(true);
  });

  it('returns false when popup is blocked', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    
    const result = openUrlInNewTab('https://example.com');
    expect(result).toBe(false);
  });
});
