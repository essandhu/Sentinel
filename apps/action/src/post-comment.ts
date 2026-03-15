import { formatComment } from './format-comment.js';
import type { DiffSummary } from '@sentinel/cli';

export const MARKER = '<!-- sentinel-visual-diff -->';

type Octokit = {
  rest: {
    issues: {
      listComments: (params: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page?: number;
      }) => Promise<{ data: Array<{ id: number; body?: string }> }>;
      createComment: (params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }) => Promise<unknown>;
      updateComment: (params: {
        owner: string;
        repo: string;
        comment_id: number;
        body: string;
      }) => Promise<unknown>;
    };
  };
};

/**
 * Create or update a sticky PR comment that contains the sentinel diff results.
 * Identifies the existing comment by the HTML marker at the start of the body.
 */
export async function upsertComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  const markedBody = `${MARKER}\n${body}`;

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find((c) => c.body?.includes(MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: markedBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: markedBody,
    });
  }
}
