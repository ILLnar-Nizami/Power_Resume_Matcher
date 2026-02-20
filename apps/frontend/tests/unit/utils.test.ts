import { describe, expect, it } from 'vitest';
import { cn, formatDateRange } from '@/lib/utils';

describe('cn', () => {
  it('combines string class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('handles object inputs', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 px-4')).toBe('px-4');
  });
});

describe('formatDateRange', () => {
  it('returns empty string for undefined', () => {
    expect(formatDateRange(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatDateRange(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatDateRange('')).toBe('');
  });

  it('handles en-dash conversion', () => {
    expect(formatDateRange('Jun 2025 – Aug 2025')).toBe('Jun 2025 - Aug 2025');
  });

  it('handles em-dash conversion', () => {
    expect(formatDateRange('Jun 2025 — Aug 2025')).toBe('Jun 2025 - Aug 2025');
  });

  it('normalizes spacing around hyphens', () => {
    expect(formatDateRange('Jun 2025-Aug 2025')).toBe('Jun 2025 - Aug 2025');
  });

  it('handles month year pattern without separator', () => {
    expect(formatDateRange('Jun 2025 Aug 2025')).toBe('Jun 2025 - Aug 2025');
  });

  it('handles year pattern without separator', () => {
    expect(formatDateRange('2023 2025')).toBe('2023 - 2025');
  });

  it('handles Present keyword', () => {
    expect(formatDateRange('Jun 2025 Present')).toBe('Jun 2025 - Present');
  });

  it('handles Current keyword', () => {
    expect(formatDateRange('Jan 2020 Current')).toBe('Jan 2020 - Current');
  });

  it('handles Ongoing keyword', () => {
    expect(formatDateRange('Jun 2025 Ongoing')).toBe('Jun 2025 - Ongoing');
  });

  it('preserves already formatted dates', () => {
    expect(formatDateRange('Jun 2025 - Aug 2025')).toBe('Jun 2025 - Aug 2025');
  });

  it('handles abbreviation with period', () => {
    expect(formatDateRange('Jun. 2025 Aug. 2026')).toBe('Jun. 2025 - Aug. 2026');
  });
});
