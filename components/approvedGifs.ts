// Approved GIFs live in src/assets/approved-gifs/ with a manifest.json listing
// the filenames. Globbing eagerly gives asset URLs that survive the Vite build.
// Shared by the main chat (PixelingsChat) and the mini chat (MiniChat).
const GIF_MODULES = import.meta.glob('../src/assets/approved-gifs/*.{gif,png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export type ApprovedGif = { name: string; url: string };
export const GIF_MESSAGE_PREFIX = '[gif] ';

const manifest = import.meta.glob('../src/assets/approved-gifs/manifest.json', {
  eager: true,
  import: 'default',
}) as Record<string, string[]>;

const names = Object.values(manifest)[0] || [];
export const APPROVED_GIFS: ApprovedGif[] = names
  .map((fileName: string) => {
    const match = Object.entries(GIF_MODULES).find(([path]) => path.endsWith('/' + fileName));
    return match ? { name: fileName.replace(/\.[^.]+$/, ''), url: match[1] } : null;
  })
  .filter((gif): gif is ApprovedGif => gif !== null);
