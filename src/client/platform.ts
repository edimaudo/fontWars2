/** Runtime switches for the standalone Vercel/browser preview. */
export function isWebPreview(): boolean {
  if (import.meta.env.MODE === 'web-preview') return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}
