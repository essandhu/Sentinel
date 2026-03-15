import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { trpc, trpcClient, queryClient } from '../trpc';
import { SketchUploadCard } from '../components/SketchUploadCard';
import { PenpotExportCard } from '../components/PenpotExportCard';
import { NotificationPreferencesCard } from '../components/NotificationPreferencesCard';
import { ApiKeysCard } from '../components/ApiKeysCard';
import { LoadingState } from '../components/ui/LoadingState';
import { PageHeader } from '../components/ui/PageHeader';

export function SettingsPage() {
  let orgRole: string | undefined;
  try {
    const auth = useAuth();
    orgRole = auth.orgRole ?? undefined;
  } catch {
    // Clerk not configured
  }
  const isAdmin = orgRole === 'org:admin';

  const { data: settings, isLoading } = useQuery(
    trpc.settings.get.queryOptions(),
  );

  const { data: designStatus } = useQuery(
    trpc.designSources.status.queryOptions(),
  );

  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [jiraHost, setJiraHost] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraApiToken, setJiraApiToken] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [figmaAccessToken, setFigmaAccessToken] = useState('');
  const [figmaFileKey, setFigmaFileKey] = useState('');
  const [figmaWebhookUrl, setFigmaWebhookUrl] = useState(
    typeof window !== 'undefined' ? `${window.location.origin}/api/figma/webhook` : '',
  );

  const [penpotInstanceUrl, setPenpotInstanceUrl] = useState('');
  const [penpotAccessToken, setPenpotAccessToken] = useState('');

  const [zhClientId, setZhClientId] = useState('');
  const [zhAccessToken, setZhAccessToken] = useState('');
  const [zhOrgUrl, setZhOrgUrl] = useState('');
  const [zhStyleguideId, setZhStyleguideId] = useState('');

  useEffect(() => {
    if (settings) {
      setJiraHost(settings.jiraHost ?? '');
      setJiraEmail(settings.jiraEmail ?? '');
      setJiraProjectKey(settings.jiraProjectKey ?? '');
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: {
      slackWebhookUrl?: string | null;
      jiraHost?: string | null;
      jiraEmail?: string | null;
      jiraApiToken?: string | null;
      jiraProjectKey?: string | null;
    }) => {
      return trpcClient.settings.update.mutate(data);
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to save settings.' });
    },
  });

  const connectFigma = useMutation({
    mutationFn: async () => {
      return trpcClient.designSources.connectFigma.mutate({
        accessToken: figmaAccessToken,
        fileKey: figmaFileKey,
        webhookEndpointUrl: figmaWebhookUrl,
      });
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Figma connected successfully.' });
      queryClient.invalidateQueries({ queryKey: ['designSources'] });
      setFigmaAccessToken('');
      setFigmaFileKey('');
    },
    onError: (err: Error) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to connect Figma.' });
    },
  });

  const disconnectFigma = useMutation({
    mutationFn: async () => {
      return trpcClient.designSources.disconnectFigma.mutate();
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Figma disconnected.' });
      queryClient.invalidateQueries({ queryKey: ['designSources'] });
    },
    onError: (err: Error) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to disconnect Figma.' });
    },
  });

  const connectPenpot = useMutation({
    mutationFn: async () => {
      return trpcClient.designSources.connectPenpot.mutate({
        instanceUrl: penpotInstanceUrl,
        accessToken: penpotAccessToken,
      });
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Penpot connected successfully.' });
      queryClient.invalidateQueries({ queryKey: ['designSources'] });
      setPenpotInstanceUrl('');
      setPenpotAccessToken('');
    },
    onError: (err: Error) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to connect Penpot.' });
    },
  });

  const disconnectPenpot = useMutation({
    mutationFn: async () => {
      return trpcClient.designSources.disconnectPenpot.mutate();
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Penpot disconnected.' });
      queryClient.invalidateQueries({ queryKey: ['designSources'] });
    },
    onError: (err: Error) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to disconnect Penpot.' });
    },
  });

  const connectZeroheight = useMutation({
    mutationFn: () =>
      trpcClient.designSources.connectZeroheight.mutate({
        clientId: zhClientId,
        accessToken: zhAccessToken,
        orgUrl: zhOrgUrl,
        styleguideId: zhStyleguideId,
      }),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Zeroheight connected successfully.' });
      setZhClientId(''); setZhAccessToken(''); setZhOrgUrl(''); setZhStyleguideId('');
      queryClient.invalidateQueries({ queryKey: ['designSources'] });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to connect Zeroheight.' });
    },
  });

  const disconnectZeroheight = useMutation({
    mutationFn: () => trpcClient.designSources.disconnectZeroheight.mutate(),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Zeroheight disconnected.' });
      queryClient.invalidateQueries({ queryKey: ['designSources'] });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to disconnect Zeroheight.' });
    },
  });

  const syncZeroheight = useMutation({
    mutationFn: () => trpcClient.designSources.syncZeroheight.mutate({}),
    onSuccess: (data: any) => {
      setMessage({ type: 'success', text: `Zeroheight tokens synced. ${data.tokenCount} tokens found.` });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message ?? 'Failed to sync Zeroheight tokens.' });
    },
  });

  const handleDisconnectZeroheight = () => {
    if (window.confirm('This will disconnect Zeroheight. Are you sure?')) {
      disconnectZeroheight.mutate();
    }
  };

  const handleSave = () => {
    setMessage(null);
    const data: Record<string, string | null | undefined> = {};
    if (slackWebhookUrl) data.slackWebhookUrl = slackWebhookUrl;
    if (jiraHost) data.jiraHost = jiraHost;
    if (jiraEmail) data.jiraEmail = jiraEmail;
    if (jiraApiToken) data.jiraApiToken = jiraApiToken;
    if (jiraProjectKey) data.jiraProjectKey = jiraProjectKey;
    mutation.mutate(data);
  };

  const handleDisconnectFigma = () => {
    if (window.confirm('This will disconnect Figma and remove the webhook. Are you sure?')) {
      disconnectFigma.mutate();
    }
  };

  const handleDisconnectPenpot = () => {
    if (window.confirm('This will disconnect Penpot. Are you sure?')) {
      disconnectPenpot.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <LoadingState message="Loading settings..." />
      </div>
    );
  }

  function StatusBadge({ connected }: { connected: boolean }) {
    return connected ? (
      <span className="s-pill" style={{ background: 'var(--s-success-dim)', color: 'var(--s-success)', border: '1px solid rgba(45, 212, 168, 0.2)' }}>
        Connected
      </span>
    ) : (
      <span className="s-pill" style={{ background: 'var(--s-bg-raised)', color: 'var(--s-text-tertiary)', border: '1px solid var(--s-border)' }}>
        Not configured
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 s-animate-in">
      <PageHeader title="Settings" />

      {message && (
        <div
          className="mb-4 mt-6 rounded-lg p-3 text-[13px]"
          style={{
            background: message.type === 'success' ? 'var(--s-success-dim)' : 'var(--s-danger-dim)',
            color: message.type === 'success' ? 'var(--s-success)' : 'var(--s-danger)',
            border: `1px solid ${message.type === 'success' ? 'rgba(45, 212, 168, 0.2)' : 'rgba(240, 102, 92, 0.2)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Slack Section */}
      <section className="mb-8 mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Slack Notifications
          </h2>
          <StatusBadge connected={!!settings?.slackWebhookUrl} />
        </div>
        <label className="s-input-label">Webhook URL</label>
        <input
          type="url"
          value={slackWebhookUrl}
          onChange={(e) => setSlackWebhookUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="s-input"
        />
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>
          {settings?.slackWebhookUrl
            ? 'A webhook is already configured. Enter a new URL to replace it.'
            : 'Enter a Slack incoming webhook URL to receive notifications.'}
        </p>
      </section>

      {/* Jira Section */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Jira Integration
          </h2>
          <StatusBadge connected={!!(settings?.jiraHost && settings?.jiraApiToken)} />
        </div>
        <div className="space-y-3">
          <div>
            <label className="s-input-label">Jira Host</label>
            <input type="text" value={jiraHost} onChange={(e) => setJiraHost(e.target.value)} placeholder="your-domain.atlassian.net" className="s-input" />
          </div>
          <div>
            <label className="s-input-label">Jira Email</label>
            <input type="email" value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} placeholder="bot@example.com" className="s-input" />
          </div>
          <div>
            <label className="s-input-label">Jira API Token</label>
            <input type="password" value={jiraApiToken} onChange={(e) => setJiraApiToken(e.target.value)} placeholder={settings?.jiraApiToken ? '***configured***' : 'Enter API token'} className="s-input" />
          </div>
          <div>
            <label className="s-input-label">Jira Project Key</label>
            <input type="text" value={jiraProjectKey} onChange={(e) => setJiraProjectKey(e.target.value)} placeholder="SEN" className="s-input" />
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
          Notification Preferences
        </h2>
        <NotificationPreferencesCard onMessage={setMessage} />
      </section>

      {/* API Keys - Admin only */}
      {isAdmin && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            API Keys
          </h2>
          <ApiKeysCard onMessage={setMessage} />
        </section>
      )}

      {/* Design Sources Section - Admin only */}
      {isAdmin && (
        <section className="mb-8">
          <h2 className="mb-4 text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--s-text-primary)' }}>
            Design Sources
          </h2>

          {/* Figma */}
          <div className="mb-4 s-glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--s-text-primary)' }}>Figma</h3>
              <StatusBadge connected={!!designStatus?.figma?.connected} />
            </div>

            {designStatus?.figma?.connected ? (
              <div className="space-y-2">
                <div className="text-[13px]" style={{ color: 'var(--s-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>File Key:</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{designStatus.figma.fileKey}</span>
                </div>
                <div className="text-[13px]" style={{ color: 'var(--s-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>Access Token:</span> ***configured***
                </div>
                <button onClick={handleDisconnectFigma} disabled={disconnectFigma.isPending} className="s-btn s-btn-danger mt-2">
                  {disconnectFigma.isPending ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="s-input-label">Access Token</label>
                  <input type="password" value={figmaAccessToken} onChange={(e) => setFigmaAccessToken(e.target.value)} placeholder="Enter Figma access token" className="s-input" />
                </div>
                <div>
                  <label className="s-input-label">File Key</label>
                  <input type="text" value={figmaFileKey} onChange={(e) => setFigmaFileKey(e.target.value)} placeholder="Enter Figma file key" className="s-input" />
                </div>
                <div>
                  <label className="s-input-label">Webhook Endpoint URL</label>
                  <input type="url" value={figmaWebhookUrl} onChange={(e) => setFigmaWebhookUrl(e.target.value)} placeholder="https://your-domain.com/api/figma/webhook" className="s-input" />
                </div>
                <button onClick={() => connectFigma.mutate()} disabled={connectFigma.isPending} className="s-btn s-btn-primary">
                  {connectFigma.isPending ? 'Connecting...' : 'Connect Figma'}
                </button>
              </div>
            )}
          </div>

          {/* Penpot */}
          <div className="mb-4 s-glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--s-text-primary)' }}>Penpot</h3>
              <StatusBadge connected={!!designStatus?.penpot?.connected} />
            </div>

            {designStatus?.penpot?.connected ? (
              <div className="space-y-2">
                <div className="text-[13px]" style={{ color: 'var(--s-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>Instance URL:</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{designStatus.penpot.instanceUrl}</span>
                </div>
                <div className="text-[13px]" style={{ color: 'var(--s-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>Access Token:</span> ***configured***
                </div>
                <button onClick={handleDisconnectPenpot} disabled={disconnectPenpot.isPending} className="s-btn s-btn-danger mt-2">
                  {disconnectPenpot.isPending ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="s-input-label">Instance URL</label>
                  <input type="url" value={penpotInstanceUrl} onChange={(e) => setPenpotInstanceUrl(e.target.value)} placeholder="https://design.penpot.app" className="s-input" />
                </div>
                <div>
                  <label className="s-input-label">Access Token</label>
                  <input type="password" value={penpotAccessToken} onChange={(e) => setPenpotAccessToken(e.target.value)} placeholder="Enter Penpot access token" className="s-input" />
                </div>
                <button onClick={() => connectPenpot.mutate()} disabled={connectPenpot.isPending} className="s-btn s-btn-primary">
                  {connectPenpot.isPending ? 'Connecting...' : 'Connect Penpot'}
                </button>
              </div>
            )}
          </div>

          {/* Zeroheight */}
          <div className="mb-4 s-glass p-4">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--s-text-primary)' }}>Zeroheight</h3>
              <StatusBadge connected={!!designStatus?.zeroheight?.connected} />
            </div>

            {designStatus?.zeroheight?.connected ? (
              <div className="space-y-2">
                <div className="text-[13px]" style={{ color: 'var(--s-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--s-text-primary)' }}>Org URL:</span>{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{designStatus.zeroheight.orgUrl}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => syncZeroheight.mutate()} disabled={syncZeroheight.isPending} className="s-btn s-btn-primary">
                    {syncZeroheight.isPending ? 'Syncing...' : 'Sync Tokens'}
                  </button>
                  <button onClick={handleDisconnectZeroheight} disabled={disconnectZeroheight.isPending} className="s-btn s-btn-danger">
                    {disconnectZeroheight.isPending ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="s-input-label">Client ID</label>
                  <input type="text" value={zhClientId} onChange={(e) => setZhClientId(e.target.value)} placeholder="Enter Zeroheight client ID" className="s-input" />
                </div>
                <div>
                  <label className="s-input-label">Access Token</label>
                  <input type="password" value={zhAccessToken} onChange={(e) => setZhAccessToken(e.target.value)} placeholder="Enter Zeroheight access token" className="s-input" />
                </div>
                <div>
                  <label className="s-input-label">Org URL</label>
                  <input type="url" value={zhOrgUrl} onChange={(e) => setZhOrgUrl(e.target.value)} placeholder="https://myorg.zeroheight.com" className="s-input" />
                </div>
                <div>
                  <label className="s-input-label">Styleguide ID</label>
                  <input type="text" value={zhStyleguideId} onChange={(e) => setZhStyleguideId(e.target.value)} placeholder="Enter Zeroheight styleguide ID" className="s-input" />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--s-text-tertiary)' }}>
                  Requires Zeroheight Enterprise plan. Find credentials in Zeroheight Settings &gt; API.
                </p>
                <button onClick={() => connectZeroheight.mutate()} disabled={connectZeroheight.isPending} className="s-btn s-btn-primary">
                  {connectZeroheight.isPending ? 'Connecting...' : 'Connect Zeroheight'}
                </button>
              </div>
            )}
          </div>

          {/* Sketch Upload */}
          <SketchUploadCard onMessage={setMessage} />

          {/* Penpot Export - only shown when connected */}
          {designStatus?.penpot?.connected && (
            <PenpotExportCard onMessage={setMessage} />
          )}
        </section>
      )}

      {/* Save Button */}
      <button onClick={handleSave} disabled={mutation.isPending} className="s-btn s-btn-primary">
        {mutation.isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
