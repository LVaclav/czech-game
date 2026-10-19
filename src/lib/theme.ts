export type ThemeId = 'dark';

export function getSavedTheme(): ThemeId {
  return 'dark';
}

export function applyTheme(_theme: ThemeId): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', 'dark');
}
