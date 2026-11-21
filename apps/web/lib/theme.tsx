// White label: the org's brand applied as CSS variables. Colors were validated (WCAG contrast) when saved.
import { themeOf, type Branding } from "@spark/core";

export function ThemeStyle({ branding }: { branding: Branding | undefined }) {
  const t = themeOf(branding);
  const css = `:root{--accent:${t.accent};--accent-ink:${t.accentInk};--surface:${t.surface}}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export function BrandMark({ branding }: { branding: Branding | undefined }) {
  const t = themeOf(branding);
  return (
    <span className="brand">
      {t.logo ? <img src={t.logo} alt="" className="logo" /> : <span className="mark" aria-hidden>✦</span>}
      <span>{t.displayName}</span>
    </span>
  );
}
