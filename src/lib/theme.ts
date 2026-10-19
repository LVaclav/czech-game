export type ThemeId = 'sapphire' | 'daylight' | 'vltava' | 'twilight';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  shortName: string;
  tagline: string;
  swatchBg: string;
  swatchAccent: string;
  metaThemeColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'sapphire',
    name: 'Sapphire Glass',
    shortName: 'Sapphire',
    tagline: 'Rich cobalt sky & luminous cyan glass',
    swatchBg: '#1C3158',
    swatchAccent: '#38BDF8',
    metaThemeColor: '#1e345c',
  },
  {
    id: 'daylight',
    name: 'Cerulean Sky',
    shortName: 'Sky',
    tagline: 'Brighter azure blue & frosted ice glass',
    swatchBg: '#2D5A88',
    swatchAccent: '#7DD3FC',
    metaThemeColor: '#2d5a88',
  },
  {
    id: 'vltava',
    name: 'Ocean Teal Glass',
    shortName: 'Ocean',
    tagline: 'Deep aquamarine & mint liquid glass',
    swatchBg: '#173A47',
    swatchAccent: '#2DD4BF',
    metaThemeColor: '#173a47',
  },
  {
    id: 'twilight',
    name: 'Dusk Indigo Glass',
    shortName: 'Indigo',
    tagline: 'Evening periwinkle & starlight glass',
    swatchBg: '#242954',
    swatchAccent: '#818CF8',
    metaThemeColor: '#242954',
  },
];

const THEME_STORAGE_KEY = 'czech_trainer_theme_v2';

export function getSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore
  }
  return 'sapphire';
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.getElementById('meta-theme-color');
  const found = THEME_OPTIONS.find((t) => t.id === theme);
  if (meta && found) {
    meta.setAttribute('content', found.metaThemeColor);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore
  }
}
