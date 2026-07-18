import { useCallback, useEffect, useState } from 'react';

export const THEME_STORAGE_KEY = 'powerform.theme.v1';
export const THEME_OPTIONS = ['light', 'dark', 'system'];

const LIGHT_TOKENS = {
  '--ui-bg': '#f5f5f7',
  '--ui-surface': '#ffffff',
  '--ui-surface-subtle': '#fafafa',
  '--ui-surface-muted': '#f3f4f6',
  '--ui-hover': '#f3f4f6',
  '--ui-border': '#e5e7eb',
  '--ui-border-soft': '#ececef',
  '--ui-border-strong': '#d1d5db',
  '--ui-text': '#111827',
  '--ui-text-secondary': '#374151',
  '--ui-text-muted': '#6b7280',
  '--ui-text-faint': '#9ca3af',
  '--ui-active': '#1f2937',
  '--ui-active-text': '#ffffff',
  '--ui-info-bg': '#eff6ff',
  '--ui-warning-bg': '#fef3c7',
  '--ui-warning-border': '#fcd34d',
  '--ui-warning-text': '#92400e',
  '--ui-success-bg': '#ecfdf5',
  '--ui-success-border': '#a7f3d0',
  '--ui-success-text': '#065f46',
  '--ui-danger-bg': '#fef2f2',
  '--ui-danger-border': '#fca5a5',
  '--ui-danger-text': '#991b1b',
  '--ui-overlay': 'rgba(15, 23, 42, 0.5)',
  '--ui-shadow': 'rgba(15, 23, 42, 0.15)',
  '--ui-shadow-soft': 'rgba(15, 23, 42, 0.08)',
};

const DARK_TOKENS = {
  '--ui-bg': '#0b1120',
  '--ui-surface': '#111827',
  '--ui-surface-subtle': '#172033',
  '--ui-surface-muted': '#1f2937',
  '--ui-hover': '#253247',
  '--ui-border': '#334155',
  '--ui-border-soft': '#273449',
  '--ui-border-strong': '#475569',
  '--ui-text': '#f3f4f6',
  '--ui-text-secondary': '#cbd5e1',
  '--ui-text-muted': '#94a3b8',
  '--ui-text-faint': '#718096',
  '--ui-active': '#3b82f6',
  '--ui-active-text': '#ffffff',
  '--ui-info-bg': '#172554',
  '--ui-warning-bg': '#422006',
  '--ui-warning-border': '#a16207',
  '--ui-warning-text': '#fde68a',
  '--ui-success-bg': '#052e2b',
  '--ui-success-border': '#047857',
  '--ui-success-text': '#a7f3d0',
  '--ui-danger-bg': '#450a0a',
  '--ui-danger-border': '#b91c1c',
  '--ui-danger-text': '#fecaca',
  '--ui-overlay': 'rgba(2, 6, 23, 0.72)',
  '--ui-shadow': 'rgba(0, 0, 0, 0.42)',
  '--ui-shadow-soft': 'rgba(0, 0, 0, 0.3)',
};

export function resolveTheme(preference, systemIsDark) {
  return preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;
}

function readPreference() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_OPTIONS.includes(stored) ? stored : 'system';
  } catch (e) {
    return 'system';
  }
}

function readSystemIsDark() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function useAppTheme() {
  const [preference, setPreferenceState] = useState(readPreference);
  const [systemIsDark, setSystemIsDark] = useState(readSystemIsDark);
  const resolvedTheme = resolveTheme(preference, systemIsDark);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (event) => setSystemIsDark(event.matches);
    if (media.addEventListener) media.addEventListener('change', onChange);
    else media.addListener?.(onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else media.removeListener?.(onChange);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch (e) { /* storage blocked */ }
    document.documentElement.dataset.theme = resolvedTheme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [preference, resolvedTheme]);

  const setPreference = useCallback((next) => {
    if (THEME_OPTIONS.includes(next)) setPreferenceState(next);
  }, []);

  return {
    preference,
    resolvedTheme,
    setPreference,
    themeTokens: resolvedTheme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS,
  };
}

const OPTION_META = {
  light: { icon: '☀', label: 'Light' },
  dark: { icon: '☾', label: 'Dark' },
  system: { icon: '◐', label: 'System' },
};

export function ThemeToggle({ value, resolvedTheme, onChange }) {
  return (
    <div
      role="group"
      aria-label="Interface theme"
      title={`Theme: ${OPTION_META[value].label}${value === 'system' ? ` (${resolvedTheme})` : ''}`}
      style={{
        display: 'flex', alignItems: 'center', padding: 2, gap: 2,
        background: 'var(--ui-surface-muted)', border: '1px solid var(--ui-border)',
        borderRadius: 7,
      }}
    >
      {['light', 'system', 'dark'].map((option) => {
        const active = value === option;
        const meta = OPTION_META[option];
        return (
          <button
            key={option}
            type="button"
            aria-label={`${meta.label} theme`}
            aria-pressed={active}
            title={`${meta.label} theme${option === 'system' ? ` (currently ${resolvedTheme})` : ''}`}
            onClick={() => onChange(option)}
            style={{
              width: 26, height: 24, padding: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: active ? '1px solid var(--ui-border-strong)' : '1px solid transparent',
              borderRadius: 5,
              background: active ? 'var(--ui-surface)' : 'transparent',
              color: active ? 'var(--ui-text)' : 'var(--ui-text-muted)',
              boxShadow: active ? '0 1px 2px var(--ui-shadow-soft)' : 'none',
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', lineHeight: 1,
            }}
          >
            <span aria-hidden="true">{meta.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
