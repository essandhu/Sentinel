export declare const MARKER = "<!-- sentinel-visual-diff -->";
type Octokit = {
    rest: {
        issues: {
            listComments: (params: {
                owner: string;
                repo: string;
                issue_number: number;
                per_page?: number;
            }) => Promise<{
                data: Array<{
                    id: number;
                    body?: string;
                }>;
            }>;
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
export declare function upsertComment(octokit: Octokit, owner: string, repo: string, prNumber: number, body: string): Promise<void>;
export {};
