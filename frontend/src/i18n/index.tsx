// Lightweight, dependency-free i18n for the whole CRM.
//
// Why custom (no react-i18next): the app is on React 19 with a bespoke build; a tiny
// context + dot-path lookup gives us reactive language switching, English fallback and
// {{var}} interpolation without adding a runtime dependency. Locale dictionaries live in
// ./locales and all mirror the English shape (en.ts is the source of truth).
//
// Usage:
//   const { t, lang, setLang, languages } = useT();
//   <h1>{t('nav.dashboard')}</h1>
//   t('portal.reason')                       // simple key
//   t('greeting', { name })                  // interpolates {{name}}
import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import en from './locales/en';
import hi from './locales/hi';
import ta from './locales/ta';
import te from './locales/te';
import { getLanguage, setLanguage } from '@/lib/theme';

export type Lang = 'en' | 'hi' | 'ta' | 'te';

export const LANGUAGES: { code: Lang; label: string; english: string }[] = [
  { code: 'en', label: 'English', english: 'English' },
  { code: 'hi', label: 'हिन्दी', english: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', english: 'Tamil' },
  { code: 'te', label: 'తెలుగు', english: 'Telugu' },
];

// Locale dictionaries are looked up dynamically by dot-path (see `lookup`), so we keep them
// as `unknown` here. This tolerates each locale being authored independently — with or without
// `as const`, complete or partial — while English (typed) remains the fallback source of truth.
const DICTS: Record<Lang, unknown> = { en, hi, ta, te };

function normalize(code: string | null | undefined): Lang {
  return code === 'hi' || code === 'ta' || code === 'te' ? code : 'en';
}

/** Walk a dot-path (`a.b.c`) into a nested object; returns undefined if any hop is missing. */
function lookup(dict: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Build a translate function bound to a language (English fallback, then the raw key). */
export function makeT(lang: Lang): TFn {
  return (key, vars) => {
    const hit = lookup(DICTS[lang], key);
    const val = typeof hit === 'string' ? hit : (typeof lookup(en, key) === 'string' ? (lookup(en, key) as string) : key);
    return interpolate(val, vars);
  };
}

interface I18nCtx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFn;
  languages: typeof LANGUAGES;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => normalize(getLanguage()));

  // Keep <html lang> in sync for accessibility / correct font shaping of Indic scripts.
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setLanguage(next); // persists to localStorage (shared with the employee portal)
  }, []);

  const t = useMemo(() => makeT(lang), [lang]);
  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useT must be used within <I18nProvider>');
  return ctx;
}
