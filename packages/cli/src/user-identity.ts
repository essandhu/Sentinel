import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface UserIdentity {
  name: string;
  email: string;
}

const gitConfig = async (key: string, cwd?: string): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync('git', ['config', '--get', key], {
      cwd: cwd ?? process.cwd(),
      timeout: 3000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
};

export const resolveUserIdentity = async (cwd?: string): Promise<UserIdentity> => {
  const name = process.env.SENTINEL_USER ?? await gitConfig('user.name', cwd) ?? 'local';
  const email = process.env.SENTINEL_EMAIL ?? await gitConfig('user.email', cwd) ?? 'local';
  return { name, email };
};
