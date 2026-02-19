import { describe, expect, it } from 'vitest';
import { sanitizeHtml, stripHtml, isHtmlContent } from '@/lib/utils/html-sanitizer';

describe('sanitizeHtml', () => {
  it('allows safe HTML tags', () => {
    const result = sanitizeHtml('<strong>bold</strong> and <em>italic</em>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('removes dangerous tags like script', () => {
    const result = sanitizeHtml('<script>alert("xss")</script><strong>safe</strong>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('<strong>safe</strong>');
  });

  it('removes dangerous attributes', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('allows href attribute on links', () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('href="https://example.com"');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('handles plain text without HTML', () => {
    expect(sanitizeHtml('just plain text')).toBe('just plain text');
  });

  it('removes iframe', () => {
    const result = sanitizeHtml('<iframe src="evil.com"></iframe>content');
    expect(result).not.toContain('<iframe>');
    expect(result).toContain('content');
  });
});

describe('stripHtml', () => {
  it('removes all HTML tags', () => {
    expect(stripHtml('<strong>bold</strong> and <em>italic</em>')).toBe('bold and italic');
  });

  it('handles nested tags', () => {
    expect(stripHtml('<div><p>text</p></div>')).toBe('text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });
});

describe('isHtmlContent', () => {
  it('detects HTML tags', () => {
    expect(isHtmlContent('<p>hello</p>')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isHtmlContent('just plain text')).toBe(false);
  });

  it('detects self-closing tags', () => {
    expect(isHtmlContent('<br/>')).toBe(true);
  });

  it('detects uppercase tags', () => {
    expect(isHtmlContent('<DIV>test</DIV>')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isHtmlContent('')).toBe(false);
  });
});
