import { IncomingWebhook } from '@slack/webhook';

export interface DriftNotification {
  projectName: string;
  componentCount: number;
  failedDiffCount: number;
  totalDiffCount: number;
  dashboardUrl: string;
  runId: string;
}

export async function sendDriftNotification(
  webhookUrl: string,
  data: DriftNotification,
): Promise<void> {
  const webhook = new IncomingWebhook(webhookUrl);

  await webhook.send({
    text: `Drift detected in ${data.projectName}: ${data.failedDiffCount} of ${data.totalDiffCount} diffs failed across ${data.componentCount} components`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Visual Drift Detected' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project:*\n${data.projectName}` },
          {
            type: 'mrkdwn',
            text: `*Components Affected:*\n${data.componentCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Failed Diffs:*\n${data.failedDiffCount} / ${data.totalDiffCount}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View in Dashboard' },
            url: `${data.dashboardUrl}/runs/${data.runId}`,
          },
        ],
      },
    ],
  });
}

export interface EnvironmentDriftNotification {
  projectName: string;
  sourceEnv: string;
  targetEnv: string;
  failedRouteCount: number;
  totalRouteCount: number;
  dashboardUrl: string;
}

export async function sendEnvironmentDriftNotification(
  webhookUrl: string,
  data: EnvironmentDriftNotification,
): Promise<void> {
  const webhook = new IncomingWebhook(webhookUrl);

  await webhook.send({
    text: `Environment drift detected in ${data.projectName}: ${data.failedRouteCount} of ${data.totalRouteCount} routes differ between ${data.sourceEnv} and ${data.targetEnv}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Environment Drift Detected' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project:*\n${data.projectName}` },
          {
            type: 'mrkdwn',
            text: `*Environments:*\n${data.sourceEnv} vs ${data.targetEnv}`,
          },
          {
            type: 'mrkdwn',
            text: `*Failed Routes:*\n${data.failedRouteCount} / ${data.totalRouteCount}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Comparison' },
            url: data.dashboardUrl,
          },
        ],
      },
    ],
  });
}
