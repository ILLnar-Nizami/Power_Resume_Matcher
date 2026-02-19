import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const mockResume = {
  id: '1',
  title: 'Test Resume',
  personal_info: {
    full_name: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    location: 'New York, NY',
    url_linkedin: 'https://linkedin.com/in/johndoe',
    url_github: 'https://github.com/johndoe',
  },
  summary: 'Experienced software engineer',
  skills: ['JavaScript', 'TypeScript', 'React'],
  experience: [
    {
      id: 'exp_1',
      title: 'Senior Engineer',
      subtitle: 'Tech Corp',
      current: true,
      date_start: '2020-01',
      date_end: '',
      descriptions: ['Led team of 5 engineers'],
    },
  ],
  education: [
    {
      id: 'edu_1',
      institution: 'MIT',
      degree: 'BS Computer Science',
      date_start: '2016',
      date_end: '2020',
    },
  ],
  projects: [],
  certifications: [],
  languages: [],
  additional: [],
};

const server = setupServer(
  http.get('/api/resumes', () => {
    return HttpResponse.json([mockResume]);
  }),
  http.get('/api/resumes/:id', () => {
    return HttpResponse.json(mockResume);
  }),
  http.post('/api/resumes', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...mockResume, ...body, id: 'new-id' });
  }),
  http.put('/api/resumes/:id', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...mockResume, ...body });
  }),
  http.delete('/api/resumes/:id', () => {
    return new HttpResponse(null, { status: 204 });
  })
);

beforeAll(() => {
  server.listen();
});

afterAll(() => {
  server.close();
});

describe('Resume API Integration', () => {
  it('fetches all resumes', async () => {
    const response = await fetch('/api/resumes');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].title).toBe('Test Resume');
  });

  it('fetches single resume by ID', async () => {
    const response = await fetch('/api/resumes/1');
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.id).toBe('1');
    expect(data.personal_info.full_name).toBe('John Doe');
  });

  it('creates a new resume', async () => {
    const newResume = { title: 'New Resume' };
    const response = await fetch('/api/resumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newResume),
    });
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.id).toBe('new-id');
    expect(data.title).toBe('New Resume');
  });

  it('updates an existing resume', async () => {
    const updates = { title: 'Updated Resume' };
    const response = await fetch('/api/resumes/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.title).toBe('Updated Resume');
  });

  it('deletes a resume', async () => {
    const response = await fetch('/api/resumes/1', { method: 'DELETE' });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(204);
  });

  it('handles network errors gracefully', async () => {
    server.use(
      http.get('/api/resumes', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const response = await fetch('/api/resumes');
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
  });
});
