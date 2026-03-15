const isLocalMode = __SENTINEL_MODE__ === 'local';
const localBase = 'http://localhost:5678';

export function imageUrl(storageKey: string): string {
  if (isLocalMode) {
    return `${localBase}/images/${storageKey}`;
  }
  return storageKey;
}
