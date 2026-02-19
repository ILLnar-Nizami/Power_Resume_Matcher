import { describe, expect, it } from 'vitest';
import {
  localizeDefaultSectionMeta,
  withLocalizedDefaultSections,
  getSectionMeta,
  getSortedSections,
  getAllSections,
  generateCustomSectionId,
  createCustomSection,
  updateSectionName,
  toggleSectionVisibility,
  deleteSection,
  moveSectionUp,
  moveSectionDown,
  normalizeOrders,
  getSectionTypeLabel,
  DEFAULT_SECTION_META,
} from '@/lib/utils/section-helpers';
import type { ResumeData, SectionMeta } from '@/components/dashboard/resume-component';

const mockTranslation = (key: string) => {
  const translations: Record<string, string> = {
    'resume.sections.personalInfo': 'Informations Personnelles',
    'resume.sections.summary': 'Résumé',
    'resume.sections.experience': 'Expérience',
    'resume.sections.education': 'Éducation',
    'resume.sections.projects': 'Projets',
    'resume.sections.skills': 'Compétences',
  };
  return translations[key] || key;
};

describe('localizeDefaultSectionMeta', () => {
  it('localizes default section names', () => {
    const result = localizeDefaultSectionMeta(DEFAULT_SECTION_META, mockTranslation);
    
    expect(result.find(s => s.id === 'personalInfo')?.displayName).toBe('Informations Personnelles');
    expect(result.find(s => s.id === 'summary')?.displayName).toBe('Résumé');
  });

  it('does not modify custom sections', () => {
    const customSection: SectionMeta = {
      id: 'custom_1',
      key: 'custom_1',
      displayName: 'My Custom Section',
      sectionType: 'text',
      isDefault: false,
      isVisible: true,
      order: 10,
    };
    
    const result = localizeDefaultSectionMeta([...DEFAULT_SECTION_META, customSection], mockTranslation);
    expect(result.find(s => s.id === 'custom_1')?.displayName).toBe('My Custom Section');
  });

  it('does not modify user-modified default sections', () => {
    const modified: SectionMeta[] = DEFAULT_SECTION_META.map(s => 
      s.id === 'summary' ? { ...s, displayName: 'Custom Summary' } : s
    );
    
    const result = localizeDefaultSectionMeta(modified, mockTranslation);
    expect(result.find(s => s.id === 'summary')?.displayName).toBe('Custom Summary');
  });
});

describe('withLocalizedDefaultSections', () => {
  it('applies localization to resume data', () => {
    const resumeData: ResumeData = {};
    const result = withLocalizedDefaultSections(resumeData, mockTranslation);
    
    expect(result.sectionMeta).toBeDefined();
    expect(result.sectionMeta?.find(s => s.id === 'summary')?.displayName).toBe('Résumé');
  });

  it('preserves existing custom sections', () => {
    const resumeData: ResumeData = {
      sectionMeta: [
        ...DEFAULT_SECTION_META,
        { id: 'custom_1', key: 'custom_1', displayName: 'Custom', sectionType: 'text', isDefault: false, isVisible: true, order: 10 },
      ],
    };
    
    const result = withLocalizedDefaultSections(resumeData, mockTranslation);
    expect(result.sectionMeta?.find(s => s.id === 'custom_1')?.displayName).toBe('Custom');
  });
});

describe('getSectionMeta', () => {
  it('returns default meta when not present', () => {
    const result = getSectionMeta({});
    expect(result).toEqual(DEFAULT_SECTION_META);
  });

  it('returns provided meta when present', () => {
    const customMeta: SectionMeta[] = [{ id: 'test', key: 'test', displayName: 'Test', sectionType: 'text', isDefault: false, isVisible: true, order: 0 }];
    const result = getSectionMeta({ sectionMeta: customMeta });
    expect(result).toEqual(customMeta);
  });
});

describe('getSortedSections', () => {
  it('returns only visible sections sorted by order', () => {
    const resumeData: ResumeData = {
      sectionMeta: [
        { id: 'a', key: 'a', displayName: 'A', sectionType: 'text', isDefault: true, isVisible: true, order: 2 },
        { id: 'b', key: 'b', displayName: 'B', sectionType: 'text', isDefault: true, isVisible: false, order: 1 },
        { id: 'c', key: 'c', displayName: 'C', sectionType: 'text', isDefault: true, isVisible: true, order: 0 },
      ],
    };
    
    const result = getSortedSections(resumeData);
    expect(result.map(s => s.id)).toEqual(['c', 'a']);
  });
});

describe('getAllSections', () => {
  it('returns all sections sorted', () => {
    const resumeData: ResumeData = {
      sectionMeta: [
        { id: 'b', key: 'b', displayName: 'B', sectionType: 'text', isDefault: true, isVisible: true, order: 1 },
        { id: 'a', key: 'a', displayName: 'A', sectionType: 'text', isDefault: true, isVisible: true, order: 0 },
      ],
    };
    
    const result = getAllSections(resumeData);
    expect(result.map(s => s.id)).toEqual(['a', 'b']);
  });
});

describe('generateCustomSectionId', () => {
  it('generates first custom ID', () => {
    const result = generateCustomSectionId(DEFAULT_SECTION_META);
    expect(result).toBe('custom_1');
  });

  it('generates next ID when custom sections exist', () => {
    const sections: SectionMeta[] = [
      ...DEFAULT_SECTION_META,
      { id: 'custom_1', key: 'custom_1', displayName: 'Custom', sectionType: 'text', isDefault: false, isVisible: true, order: 10 },
      { id: 'custom_3', key: 'custom_3', displayName: 'Custom 3', sectionType: 'text', isDefault: false, isVisible: true, order: 11 },
    ];
    
    const result = generateCustomSectionId(sections);
    expect(result).toBe('custom_4');
  });
});

describe('createCustomSection', () => {
  it('creates a new custom section', () => {
    const result = createCustomSection(DEFAULT_SECTION_META, 'My Section', 'text');
    
    expect(result.id).toBe('custom_1');
    expect(result.displayName).toBe('My Section');
    expect(result.sectionType).toBe('text');
    expect(result.isDefault).toBe(false);
    expect(result.isVisible).toBe(true);
    expect(result.order).toBe(6);
  });
});

describe('updateSectionName', () => {
  it('updates section name', () => {
    const result = updateSectionName(DEFAULT_SECTION_META, 'summary', 'New Summary');
    expect(result.find(s => s.id === 'summary')?.displayName).toBe('New Summary');
  });

  it('returns unchanged array for unknown id', () => {
    const result = updateSectionName(DEFAULT_SECTION_META, 'unknown', 'Name');
    expect(result).toEqual(DEFAULT_SECTION_META);
  });
});

describe('toggleSectionVisibility', () => {
  it('toggles visibility', () => {
    const result = toggleSectionVisibility(DEFAULT_SECTION_META, 'summary');
    expect(result.find(s => s.id === 'summary')?.isVisible).toBe(false);
  });
});

describe('deleteSection', () => {
  it('hides default sections', () => {
    const result = deleteSection(DEFAULT_SECTION_META, 'summary');
    expect(result.find(s => s.id === 'summary')?.isVisible).toBe(false);
  });

  it('fully deletes custom sections', () => {
    const sections: SectionMeta[] = [
      ...DEFAULT_SECTION_META,
      { id: 'custom_1', key: 'custom_1', displayName: 'Custom', sectionType: 'text', isDefault: false, isVisible: true, order: 10 },
    ];
    
    const result = deleteSection(sections, 'custom_1');
    expect(result.find(s => s.id === 'custom_1')).toBeUndefined();
  });

  it('cannot delete personalInfo', () => {
    const result = deleteSection(DEFAULT_SECTION_META, 'personalInfo');
    expect(result.find(s => s.id === 'personalInfo')).toBeDefined();
  });
});

describe('moveSectionUp', () => {
  it('moves section up', () => {
    const sections: SectionMeta[] = [
      { id: 'a', key: 'a', displayName: 'A', sectionType: 'text', isDefault: true, isVisible: true, order: 0 },
      { id: 'b', key: 'b', displayName: 'B', sectionType: 'text', isDefault: true, isVisible: true, order: 1 },
    ];
    
    const result = moveSectionUp(sections, 'b');
    expect(result.find(s => s.id === 'a')?.order).toBe(1);
    expect(result.find(s => s.id === 'b')?.order).toBe(0);
  });

  it('cannot move first section up', () => {
    const sections: SectionMeta[] = [
      { id: 'a', key: 'a', displayName: 'A', sectionType: 'text', isDefault: true, isVisible: true, order: 0 },
      { id: 'b', key: 'b', displayName: 'B', sectionType: 'text', isDefault: true, isVisible: true, order: 1 },
    ];
    
    const result = moveSectionUp(sections, 'a');
    expect(result).toEqual(sections);
  });
});

describe('moveSectionDown', () => {
  it('moves section down', () => {
    const sections: SectionMeta[] = [
      { id: 'a', key: 'a', displayName: 'A', sectionType: 'text', isDefault: true, isVisible: true, order: 0 },
      { id: 'b', key: 'b', displayName: 'B', sectionType: 'text', isDefault: true, isVisible: true, order: 1 },
    ];
    
    const result = moveSectionDown(sections, 'a');
    expect(result.find(s => s.id === 'a')?.order).toBe(1);
    expect(result.find(s => s.id === 'b')?.order).toBe(0);
  });
});

describe('normalizeOrders', () => {
  it('normalizes orders to be contiguous', () => {
    const sections: SectionMeta[] = [
      { id: 'a', key: 'a', displayName: 'A', sectionType: 'text', isDefault: true, isVisible: true, order: 5 },
      { id: 'b', key: 'b', displayName: 'B', sectionType: 'text', isDefault: true, isVisible: true, order: 10 },
      { id: 'c', key: 'c', displayName: 'C', sectionType: 'text', isDefault: true, isVisible: true, order: 3 },
    ];
    
    const result = normalizeOrders(sections);
    expect(result.find(s => s.id === 'a')?.order).toBe(1);
    expect(result.find(s => s.id === 'b')?.order).toBe(2);
    expect(result.find(s => s.id === 'c')?.order).toBe(0);
  });
});

describe('getSectionTypeLabel', () => {
  it('returns correct labels', () => {
    expect(getSectionTypeLabel('personalInfo')).toBe('Personal Info');
    expect(getSectionTypeLabel('text')).toBe('Text Block');
    expect(getSectionTypeLabel('itemList')).toBe('Item List');
    expect(getSectionTypeLabel('stringList')).toBe('Skill List');
  });

  it('returns Unknown for invalid type', () => {
    expect(getSectionTypeLabel('invalid' as any)).toBe('Unknown');
  });
});
