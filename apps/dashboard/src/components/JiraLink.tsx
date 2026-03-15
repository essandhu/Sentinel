interface JiraLinkProps {
  issueKey: string | null | undefined;
  host?: string;
}

export function JiraLink({ issueKey, host }: JiraLinkProps) {
  if (!issueKey) return null;

  const jiraHost = host ?? 'jira.atlassian.net';

  return (
    <a
      href={`https://${jiraHost}/browse/${issueKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs hover:underline"
      style={{ color: 'var(--s-accent-light)' }}
    >
      {issueKey}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}
