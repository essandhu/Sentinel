import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { trpc, trpcClient, queryClient } from '../trpc';

interface NotificationPreferencesCardProps {
  onMessage: (msg: { type: 'success' | 'error'; text: string }) => void;
}

type EventType =
  | 'drift_detected'
  | 'approval_requested'
  | 'scheduled_capture_failed'
  | 'rejection_created';

type Channel = 'slack' | 'jira';

type NotificationPreferencesMap = Record<EventType, Record<Channel, boolean>>;

const EVENT_TYPES = [
  { key: 'drift_detected' as const, label: 'Drift Detected' },
  { key: 'approval_requested' as const, label: 'Approval Requested' },
  { key: 'scheduled_capture_failed' as const, label: 'Scheduled Capture Failed' },
  { key: 'rejection_created' as const, label: 'Rejection Created' },
] as const;

const CHANNELS = [
  { key: 'slack' as const, label: 'Slack' },
  { key: 'jira' as const, label: 'Jira' },
] as const;

const DEFAULT_PREFERENCES: NotificationPreferencesMap = {
  drift_detected: { slack: true, jira: true },
  approval_requested: { slack: true, jira: true },
  scheduled_capture_failed: { slack: true, jira: true },
  rejection_created: { slack: true, jira: true },
};

export function NotificationPreferencesCard({ onMessage }: NotificationPreferencesCardProps) {
  const { data, isLoading } = useQuery(
    trpc.notificationPreferences.get.queryOptions(),
  );

  const [preferences, setPreferences] = useState<NotificationPreferencesMap>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (data) {
      setPreferences(data as NotificationPreferencesMap);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return trpcClient.notificationPreferences.update.mutate({ preferences });
    },
    onSuccess: () => {
      onMessage({ type: 'success', text: 'Notification preferences saved.' });
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
    onError: (err: Error) => {
      onMessage({ type: 'error', text: err.message ?? 'Failed to save preferences.' });
    },
  });

  const toggle = (eventType: EventType, channel: Channel) => {
    setPreferences((prev) => ({
      ...prev,
      [eventType]: {
        ...prev[eventType],
        [channel]: !prev[eventType][channel],
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="s-glass rounded-lg p-4">
        <p className="text-sm" style={{ color: 'var(--s-text-secondary)' }}>Loading notification preferences...</p>
      </div>
    );
  }

  return (
    <div className="s-glass rounded-lg p-4">
      <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--s-text-primary)' }}>Notification Preferences</h3>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="s-section-label pb-2 text-left"></th>
            {CHANNELS.map((channel) => (
              <th key={channel.key} className="s-section-label pb-2 text-center">
                {channel.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EVENT_TYPES.map((event) => (
            <tr key={event.key} style={{ borderTop: '1px solid var(--s-border)' }}>
              <td className="py-2" style={{ color: 'var(--s-text-primary)' }}>{event.label}</td>
              {CHANNELS.map((channel) => (
                <td key={channel.key} className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={preferences[event.key][channel.key]}
                    onChange={() => toggle(event.key, channel.key)}
                    className="h-4 w-4 rounded accent-[var(--s-accent)]"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="s-btn s-btn-primary mt-3"
      >
        {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
