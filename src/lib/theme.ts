export type ThemeId = 'prague' | 'crystal' | 'noir' | 'vltava';

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
    id: 'prague',
    name: 'Prague Café',
    shortName: 'Prague',
    tagline: 'Warm literary parchment & Bohemian garnet',
    swatchBg: '#F7F3EB',
    swatchAccent: '#B93829',
    metaThemeColor: '#F7F3EB',
  },
  {
    id: 'crystal',
    name: 'Bohemian Crystal',
    shortName: 'Crystal',
    tagline: 'Clean Apple iOS alabaster & royal cobalt',
    swatchBg: '#F4F6FB',
    swatchAccent: '#0052CC',
    metaThemeColor: '#F4F6FB',
  },
  {
    id: 'noir',
    name: 'Karlův Most Noir',
    shortName: 'Noir',
    tagline: 'Velvet obsidian & warm champagne gold',
    swatchBg: '#0B0B0E',
    swatchAccent: '#E5A93C',
    metaThemeColor: '#0B0B0E',
  },
  {
    id: 'vltava',
    name: 'Vltava Midnight',
    shortName: 'Vltava',
    tagline: 'Deep river pine & vibrant emerald',
    swatchBg: '#081216',
    swatchAccent: '#14B8A6',
    metaThemeColor: '#081216',
  },
];

const THEME_STORAGE_KEY = 'czech_trainer_theme_v1';

export function getSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // Ignore
  }
  return 'prague';
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
