import { describe, expect, it } from 'vitest';
import {
  extractKeywords,
  matchesKeyword,
  segmentTextByKeywords,
  calculateMatchStats,
} from '@/lib/utils/keyword-matcher';

describe('extractKeywords', () => {
  it('extracts keywords from simple text', () => {
    const result = extractKeywords('JavaScript TypeScript React');
    expect(result).toContain('javascript');
    expect(result).toContain('typescript');
    expect(result).toContain('react');
  });

  it('filters out stop words', () => {
    const result = extractKeywords('the and but or JavaScript');
    expect(result).toContain('javascript');
    expect(result).not.toContain('the');
    expect(result).not.toContain('and');
  });

  it('filters out short words', () => {
    const result = extractKeywords('hi js JavaScript');
    expect(result).toContain('javascript');
    expect(result).not.toContain('hi');
    expect(result).not.toContain('js');
  });

  it('filters out pure numbers', () => {
    const result = extractKeywords('2023 2024 programming 5years');
    expect(result).toContain('programming');
    expect(result).toContain('5years');
    expect(result).not.toContain('2023');
    expect(result).not.toContain('2024');
  });

  it('handles empty string', () => {
    expect(extractKeywords('')).toEqual(new Set());
  });

  it('handles job posting common words', () => {
    const result = extractKeywords('role requirements responsibilities qualifications');
    expect(result).toEqual(new Set());
  });

  it('preserves hyphenated words', () => {
    const result = extractKeywords('full-stack react-native');
    expect(result).toContain('full-stack');
    expect(result).toContain('react-native');
  });
});

describe('matchesKeyword', () => {
  it('matches exact keyword', () => {
    const keywords = new Set(['javascript', 'typescript']);
    expect(matchesKeyword('javascript', keywords)).toBe(true);
  });

  it('is case insensitive', () => {
    const keywords = new Set(['javascript']);
    expect(matchesKeyword('JavaScript', keywords)).toBe(true);
    expect(matchesKeyword('JAVASCRIPT', keywords)).toBe(true);
  });

  it('returns false for non-matching keyword', () => {
    const keywords = new Set(['javascript']);
    expect(matchesKeyword('python', keywords)).toBe(false);
  });
});

describe('segmentTextByKeywords', () => {
  it('segments text with keyword matches', () => {
    const keywords = new Set(['javascript', 'react']);
    const result = segmentTextByKeywords('JavaScript and React', keywords);

    expect(result).toEqual([
      { text: 'JavaScript', isMatch: true },
      { text: ' ', isMatch: false },
      { text: 'and', isMatch: false },
      { text: ' ', isMatch: false },
      { text: 'React', isMatch: true },
    ]);
  });

  it('handles punctuation', () => {
    const keywords = new Set(['test']);
    const result = segmentTextByKeywords('test, testing!', keywords);

    expect(result).toEqual([
      { text: 'test', isMatch: true },
      { text: ', ', isMatch: false },
      { text: 'testing', isMatch: false },
      { text: '!', isMatch: false },
    ]);
  });

  it('handles empty keyword set', () => {
    const result = segmentTextByKeywords('Hello World', new Set());
    expect(result).toEqual([
      { text: 'Hello', isMatch: false },
      { text: ' ', isMatch: false },
      { text: 'World', isMatch: false },
    ]);
  });
});

describe('calculateMatchStats', () => {
  it('calculates match statistics', () => {
    const jdKeywords = new Set(['javascript', 'react', 'typescript', 'python']);
    const result = calculateMatchStats('I know JavaScript and React well', jdKeywords);

    expect(result.matchCount).toBe(2);
    expect(result.totalKeywords).toBe(4);
    expect(result.matchPercentage).toBe(50);
    expect(result.matchedKeywords).toEqual(new Set(['javascript', 'react']));
  });

  it('handles no matches', () => {
    const jdKeywords = new Set(['javascript', 'react']);
    const result = calculateMatchStats('I know Python and Java', jdKeywords);

    expect(result.matchCount).toBe(0);
    expect(result.matchPercentage).toBe(0);
  });

  it('handles empty JD keywords', () => {
    const result = calculateMatchStats('Some text', new Set());

    expect(result.matchCount).toBe(0);
    expect(result.totalKeywords).toBe(0);
    expect(result.matchPercentage).toBe(0);
  });

  it('calculates 100% match', () => {
    const jdKeywords = new Set(['javascript', 'react']);
    const result = calculateMatchStats('JavaScript React', jdKeywords);

    expect(result.matchPercentage).toBe(100);
  });
});
