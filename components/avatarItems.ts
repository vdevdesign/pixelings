// Pixelings profile pictures and backgrounds, bundled from src/assets.
// Images are imported eagerly so Vite fingerprints and ships them with the build.
// NOTE: no TypeScript generic on import.meta.glob — Vite's glob transform
// cannot parse a type argument and would silently return an empty module map.
const profileImages = import.meta.glob('../src/assets/pixelings-profiles/*.png', {
  eager: true,
}) as Record<string, { default: string }>;
const backgroundImages = import.meta.glob('../src/assets/pixelings-backgrounds/*.png', {
  eager: true,
}) as Record<string, { default: string }>;
export type AvatarItem = {
  id: string;
  kind: 'profile' | 'background';
  name: string;
  src: string;
  price: number;
};

const prettify = (file: string) =>
  file
    .replace(/\.png$/i, '')
    .replace(/-background$/i, '')
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const profilePrice = () => 120; // every profile picture costs the same
const backgroundPrice = () => 150; // every profile background costs the same
export const profileItems: AvatarItem[] = Object.entries(profileImages)
  .map(([path, module]) => {
    const file = path.split('/').pop() as string;
    const name = prettify(file);
    return {
      id: `profile-${file.replace(/\.png$/i, '')}`,
      kind: 'profile' as const,
      name,
      src: module.default,
      price: profilePrice(),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// These four backgrounds are excluded from the shop (the buyer asked to
// retire them): baby dragon, blushy ghost, little night bat, chomp monster.
export const RETIRED_BACKGROUND_IDS = new Set([
  'background-baby-dragon',
  'background-blushy-ghost',
  'background-little-night-bat',
  'background-chomp-monster',
]);
export const backgroundItems: AvatarItem[] = Object.entries(backgroundImages)
  .filter(([path]) => !RETIRED_BACKGROUND_IDS.has(`background-${path.split('/').pop()!.replace(/\.png$/i, '').replace(/-background$/i, '')}`))
  .map(([path, module]) => {
    const file = path.split('/').pop() as string;
    return { id: `background-${file.replace(/\.png$/i, '').replace(/-background$/i, '')}`, kind: 'background' as const, name: prettify(file), src: module.default, price: backgroundPrice() };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const avatarItems = [...profileItems, ...backgroundItems];

export const avatarItemById = new Map(avatarItems.map((item) => [item.id, item]));
