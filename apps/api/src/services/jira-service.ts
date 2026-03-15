import { Version3Client } from 'jira.js';

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

/**
 * Create a Jira issue with an ADF-formatted description.
 * Returns the issue key (e.g. "SEN-42").
 */
export async function createJiraIssue(
  config: JiraConfig,
  data: { summary: string; description: string },
): Promise<string> {
  const client = new Version3Client({
    host: `https://${config.host}`,
    authentication: {
      basic: { email: config.email, apiToken: config.apiToken },
    },
  });

  const issue = await client.issues.createIssue({
    fields: {
      summary: data.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: data.description }],
          },
        ],
      },
      issuetype: { name: 'Bug' },
      project: { key: config.projectKey },
    },
  });

  return issue.key!;
}

/**
 * Attach a file buffer to an existing Jira issue.
 */
export async function attachToJiraIssue(
  config: JiraConfig,
  issueKey: string,
  filename: string,
  buffer: Buffer,
): Promise<void> {
  const client = new Version3Client({
    host: `https://${config.host}`,
    authentication: {
      basic: { email: config.email, apiToken: config.apiToken },
    },
  });

  await client.issueAttachments.addAttachment({
    issueIdOrKey: issueKey,
    attachment: {
      filename,
      file: buffer,
    },
  });
}
