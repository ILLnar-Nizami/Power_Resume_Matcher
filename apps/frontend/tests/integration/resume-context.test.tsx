import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ResumePreviewProvider, useResumePreview } from '@/components/common/resume_previewer_context';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('ResumePreviewContext Integration', () => {
  it('provides null initial state for improvedData', () => {
    let contextValue: any;

    const TestConsumer = () => {
      contextValue = useResumePreview();
      return <div>Test</div>;
    };

    render(
      <ResumePreviewProvider>
        <TestConsumer />
      </ResumePreviewProvider>
    );

    expect(contextValue.improvedData).toBeNull();
  });

  it('allows setting improved data', async () => {
    let contextValue: any;
    const testData = {
      data: {
        request_id: 'req-123',
        resume_id: 'res-456',
        job_id: 'job-789',
        resume_preview: {
          personalInfo: {
            name: 'John Doe',
            email: 'john@example.com',
            phone: '555-1234',
            location: 'NYC',
          },
          workExperience: [],
          education: [],
          personalProjects: [],
          additional: {
            technicalSkills: ['JavaScript'],
            languages: ['English'],
            certificationsTraining: [],
            awards: [],
          },
        },
      },
    };

    const TestConsumer = () => {
      contextValue = useResumePreview();
      return (
        <div>
          <button onClick={() => contextValue.setImprovedData(testData)}>Set Data</button>
          <span data-testid="data-exists">{contextValue.improvedData ? 'yes' : 'no'}</span>
        </div>
      );
    };

    render(
      <ResumePreviewProvider>
        <TestConsumer />
      </ResumePreviewProvider>
    );

    expect(screen.getByTestId('data-exists').textContent).toBe('no');

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(contextValue.improvedData).toEqual(testData);
    expect(screen.getByTestId('data-exists').textContent).toBe('yes');
  });

  it('shares state across nested components', () => {
    const values: any[] = [];

    const ConsumerA = () => {
      const ctx = useResumePreview();
      values.push(ctx);
      return null;
    };

    const ConsumerB = () => {
      const ctx = useResumePreview();
      values.push(ctx);
      return null;
    };

    const TestComponent = () => (
      <ResumePreviewProvider>
        <ConsumerA />
        <ConsumerB />
      </ResumePreviewProvider>
    );

    render(<TestComponent />);

    expect(values).toHaveLength(2);
    expect(values[0]).toBe(values[1]);
  });

  it('updates propagate to all consumers', async () => {
    const FirstConsumer = () => {
      const { improvedData } = useResumePreview();
      return <div data-testid="first">{improvedData?.data?.request_id || 'none'}</div>;
    };

    const SecondConsumer = () => {
      const { improvedData } = useResumePreview();
      return <div data-testid="second">{improvedData?.data?.request_id || 'none'}</div>;
    };

    const testData = {
      data: {
        request_id: 'test-id',
        resume_id: null,
        job_id: 'job-1',
        resume_preview: {
          personalInfo: { name: '', email: '', phone: '', location: '' },
          workExperience: [],
          education: [],
          personalProjects: [],
          additional: { technicalSkills: [], languages: [], certificationsTraining: [], awards: [] },
        },
      },
    };

    const Parent = () => {
      const { setImprovedData } = useResumePreview();
      return (
        <>
          <FirstConsumer />
          <SecondConsumer />
          <button onClick={() => setImprovedData(testData)}>Update</button>
        </>
      );
    };

    render(
      <ResumePreviewProvider>
        <Parent />
      </ResumePreviewProvider>
    );

    expect(screen.getByTestId('first').textContent).toBe('none');
    expect(screen.getByTestId('second').textContent).toBe('none');

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(screen.getByTestId('first').textContent).toBe('test-id');
    expect(screen.getByTestId('second').textContent).toBe('test-id');
  });
});
