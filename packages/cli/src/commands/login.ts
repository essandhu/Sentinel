import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export const SENTINEL_DIR = join(homedir(), '.sentinel');
export const CREDENTIALS_PATH = join(SENTINEL_DIR, 'config.json');

export interface Credentials {
  serverUrl: string;
  apiKey: string;
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.serverUrl && parsed.apiKey) return parsed as Credentials;
    return null;
  } catch {
    return null;
  }
}

export async function saveCredentials(creds: Credentials): Promise<void> {
  await mkdir(SENTINEL_DIR, { recursive: true });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2) + '\n', {
    mode: 0o600,
  });
}

export async function loginCommand(): Promise<void> {
  const { input, password } = await import('@inquirer/prompts');
  const chalk = (await import('chalk')).default;

  const serverUrl = await input({
    message: 'Sentinel server URL:',
    default: 'http://localhost:3000',
  });

  const apiKey = await password({
    message: 'API key:',
  });

  if (!apiKey) {
    console.log(chalk.red('API key is required.'));
    process.exitCode = 1;
    return;
  }

  // Verify the key works by hitting the API root
  try {
    const url = `${serverUrl.replace(/\/+$/, '')}/api/v1/`;
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
    });
    if (!res.ok) {
      console.log(chalk.red(`Authentication failed (HTTP ${res.status}). Check your server URL and API key.`));
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    console.log(chalk.red(`Could not connect to ${serverUrl}. Is the server running?`));
    process.exitCode = 1;
    return;
  }

  await saveCredentials({ serverUrl, apiKey });
  console.log(chalk.green(`Credentials saved to ${CREDENTIALS_PATH}`));
}
