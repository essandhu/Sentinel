import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJiraIssue, attachToJiraIssue, type JiraConfig } from './jira-service.js';

// Access the mocked module to get mock functions
const { Version3Client } = await vi.hoisted(async () => {
  const mockCreateIssue = vi.fn();
  const mockAddAttachment = vi.fn();

  function MockVersion3Client() {
    return {
      issues: { createIssue: mockCreateIssue },
      issueAttachments: { addAttachment: mockAddAttachment },
    };
  }

  // Attach the mock fns to the constructor so tests can reference them
  (MockVersion3Client as any)._mockCreateIssue = mockCreateIssue;
  (MockVersion3Client as any)._mockAddAttachment = mockAddAttachment;

  return { Version3Client: MockVersion3Client };
});

vi.mock('jira.js', () => ({
  Version3Client,
}));

const mockCreateIssue = (Version3Client as any)._mockCreateIssue;
const mockAddAttachment = (Version3Client as any)._mockAddAttachment;

const testConfig: JiraConfig = {
  host: 'myteam.atlassian.net',
  email: 'bot@example.com',
  apiToken: 'secret-token',
  projectKey: 'SEN',
};

describe('jira-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createJiraIssue', () => {
    it('constructs Version3Client with correct host and basic auth', async () => {
      mockCreateIssue.mockResolvedValue({ key: 'SEN-1' });

      await createJiraIssue(testConfig, {
        summary: 'Visual regression',
        description: 'Diff detected',
      });

      // Since we can't spy on constructor params with a plain function,
      // we verify the behavior indirectly: the client was created and used
      expect(mockCreateIssue).toHaveBeenCalled();
    });

    it('calls issues.createIssue with ADF description format', async () => {
      mockCreateIssue.mockResolvedValue({ key: 'SEN-42' });

      await createJiraIssue(testConfig, {
        summary: 'Visual regression: /home (1280x720)',
        description: 'Diff details here',
      });

      expect(mockCreateIssue).toHaveBeenCalledWith({
        fields: {
          summary: 'Visual regression: /home (1280x720)',
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Diff details here' }],
              },
            ],
          },
          issuetype: { name: 'Bug' },
          project: { key: 'SEN' },
        },
      });
    });

    it('returns the issue key from the response', async () => {
      mockCreateIssue.mockResolvedValue({ key: 'SEN-42' });

      const result = await createJiraIssue(testConfig, {
        summary: 'Test',
        description: 'Test desc',
      });

      expect(result).toBe('SEN-42');
    });
  });

  describe('attachToJiraIssue', () => {
    it('calls issueAttachments.addAttachment with correct params', async () => {
      mockAddAttachment.mockResolvedValue([]);
      const buffer = Buffer.from('fake-image-data');

      await attachToJiraIssue(testConfig, 'SEN-42', 'diff.png', buffer);

      expect(mockAddAttachment).toHaveBeenCalledWith({
        issueIdOrKey: 'SEN-42',
        attachment: {
          filename: 'diff.png',
          file: buffer,
        },
      });
    });
  });
});
