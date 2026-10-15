// Pixelings profile pictures & backgrounds, bundled from src/assets.
// Images are imported eagerly so Vite fingerprints and ships them with the build.
const profileImages = import.meta.glob<{ default: string }>(
  '../assets/pixelings-profiles/*.png',
  { eager: true },
);
const backgroundImages = import.meta.glob<{ default: string }>(
  '../assets/pixelings-backgrounds/*.png',
  { eager: true },
);

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
const backgroundPrice = () => 150; // every background costs the same

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

export const backgroundItems: AvatarItem[] = Object.entries(backgroundImages)
  .map(([path, module]) => {
    const file = path.split('/').pop() as string;
    const name = prettify(file);
    return {
      id: `background-${file.replace(/\.png$/i, '')}`,
      kind: 'background' as const,
      name,
      src: module.default,
      price: backgroundPrice(),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const avatarItems = [...profileItems, ...backgroundItems];

export const avatarItemById = new Map(avatarItems.map((item) => [item.id, item]));
