export type ThemeId = 'light' | 'dark';

const THEME_STORAGE_KEY = 'czech_trainer_ios_appearance_v1';

export function getSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore
  }
  return 'light';
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.getElementById('meta-theme-color');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#000000' : '#F2F2F7');
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore
  }
}
