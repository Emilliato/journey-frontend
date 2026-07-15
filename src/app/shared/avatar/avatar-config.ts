/**
 * The learner's avatar as one JSON-serialisable config — mirrors
 * Learner.AvatarConfig on the backend, which treats it as an opaque blob.
 * Everything renders as layered inline SVG (AvatarComponent); no images.
 */
export interface AvatarConfig {
  skin: string;
  hair: 'short' | 'curly' | 'long';
  hairColor: string;
  eyes: 'happy' | 'sparkle' | 'focused';
  accessory: 'none' | 'glasses' | 'headphones' | 'cap';
  outfitColor: string;
  /** Subtly re-tints the learner's home screen. */
  themeColor: string;
}

export type AvatarState = 'idle' | 'thinking' | 'celebrating' | 'sleepy';

export const AVATAR_SKINS = ['#F5D5B8', '#F2C79A', '#E8B48A', '#C68B5E', '#9E6B47', '#6B4A34'];
export const AVATAR_HAIRS: AvatarConfig['hair'][] = ['short', 'curly', 'long'];
export const AVATAR_HAIR_COLORS = [
  '#1F1B2E',
  '#3B2417',
  '#5B3A1F',
  '#B5651D',
  '#D9A441',
  '#E11D48',
  '#4338CA',
];
export const AVATAR_EYES: AvatarConfig['eyes'][] = ['happy', 'sparkle', 'focused'];
export const AVATAR_ACCESSORIES: AvatarConfig['accessory'][] = [
  'none',
  'glasses',
  'headphones',
  'cap',
];
export const AVATAR_OUTFITS = ['#4338CA', '#F59E0B', '#FB7185', '#34D399', '#312E81', '#0EA5E9'];

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#F2C79A',
  hair: 'curly',
  hairColor: '#4B2E1E',
  eyes: 'happy',
  accessory: 'none',
  outfitColor: '#4338CA',
  themeColor: '#4338CA',
};

/**
 * Parses a stored config, falling back to the default for anything missing
 * or malformed — older learners have no avatar yet, and the server treats
 * the blob as opaque so the client must be the tolerant side.
 */
export function parseAvatarConfig(json: string | null | undefined): AvatarConfig {
  if (!json) {
    return { ...DEFAULT_AVATAR };
  }

  try {
    const raw = JSON.parse(json) as Partial<AvatarConfig>;

    return {
      skin: typeof raw.skin === 'string' ? raw.skin : DEFAULT_AVATAR.skin,
      hair: AVATAR_HAIRS.includes(raw.hair as AvatarConfig['hair'])
        ? (raw.hair as AvatarConfig['hair'])
        : DEFAULT_AVATAR.hair,
      hairColor: typeof raw.hairColor === 'string' ? raw.hairColor : DEFAULT_AVATAR.hairColor,
      eyes: AVATAR_EYES.includes(raw.eyes as AvatarConfig['eyes'])
        ? (raw.eyes as AvatarConfig['eyes'])
        : DEFAULT_AVATAR.eyes,
      accessory: AVATAR_ACCESSORIES.includes(raw.accessory as AvatarConfig['accessory'])
        ? (raw.accessory as AvatarConfig['accessory'])
        : DEFAULT_AVATAR.accessory,
      outfitColor:
        typeof raw.outfitColor === 'string' ? raw.outfitColor : DEFAULT_AVATAR.outfitColor,
      themeColor: typeof raw.themeColor === 'string' ? raw.themeColor : DEFAULT_AVATAR.themeColor,
    };
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

export function randomAvatarConfig(): AvatarConfig {
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

  return {
    skin: pick(AVATAR_SKINS),
    hair: pick(AVATAR_HAIRS),
    hairColor: pick(AVATAR_HAIR_COLORS),
    eyes: pick(AVATAR_EYES),
    accessory: pick(AVATAR_ACCESSORIES),
    outfitColor: pick(AVATAR_OUTFITS),
    themeColor: pick(AVATAR_OUTFITS),
  };
}
