import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertComment, MARKER } from '../post-comment.js';

describe('upsertComment', () => {
  let octokit: any;

  beforeEach(() => {
    octokit = {
      rest: {
        issues: {
          listComments: vi.fn(),
          createComment: vi.fn().mockResolvedValue({ data: {} }),
          updateComment: vi.fn().mockResolvedValue({ data: {} }),
        },
      },
    };
  });

  it('creates new comment when no existing comment has the marker', async () => {
    octokit.rest.issues.listComments.mockResolvedValue({
      data: [
        { id: 1, body: 'some other comment' },
        { id: 2, body: 'another comment' },
      ],
    });

    await upsertComment(octokit, 'owner', 'repo', 42, 'diff results');

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        issue_number: 42,
        body: expect.stringContaining('diff results'),
      }),
    );
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });

  it('updates existing comment when marker is found in existing comments', async () => {
    octokit.rest.issues.listComments.mockResolvedValue({
      data: [
        { id: 99, body: `${MARKER}\nOld results` },
        { id: 2, body: 'another comment' },
      ],
    });

    await upsertComment(octokit, 'owner', 'repo', 42, 'new diff results');

    expect(octokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        comment_id: 99,
        body: expect.stringContaining('new diff results'),
      }),
    );
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it('comment body starts with the sentinel-visual-diff HTML marker', async () => {
    octokit.rest.issues.listComments.mockResolvedValue({ data: [] });

    await upsertComment(octokit, 'owner', 'repo', 42, 'body content');

    const call = octokit.rest.issues.createComment.mock.calls[0][0];
    expect(call.body).toMatch(/^<!-- sentinel-visual-diff -->/);
  });
});
