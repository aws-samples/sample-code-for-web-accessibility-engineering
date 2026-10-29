/**
 * WCAG 2.x contrast helpers and the audited contrast table (Property 5 finite domain).
 *
 * Pure functions only — no Playwright imports — so the module can be used both in
 * Node test code and serialised logic checks.
 *
 * Requirements: 4.1, 4.2, 4.5, 4.6
 */

/** sRGB color, each channel 0–255. */
export type RGB = { r: number; g: number; b: number };

const HEX_RE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_RE =
  /^rgba?\(\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

function clampChannel(value: number, source: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 255) {
    throw new Error(`Color channel out of range in "${source}"`);
  }
  return Math.round(value);
}

/**
 * Parses `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)` with a = 1.
 * Throws for any other format or for translucent colors, because contrast against a
 * translucent foreground/background cannot be computed without compositing.
 */
export function parseColor(css: string): RGB {
  const input = css.trim();

  const hex = HEX_RE.exec(input);
  if (hex) {
    return {
      r: parseInt(hex[1], 16),
      g: parseInt(hex[2], 16),
      b: parseInt(hex[3], 16),
    };
  }

  const fn = RGB_RE.exec(input);
  if (fn) {
    const alphaRaw = fn[4];
    if (alphaRaw !== undefined) {
      const alpha = alphaRaw.endsWith('%')
        ? parseFloat(alphaRaw) / 100
        : parseFloat(alphaRaw);
      if (alpha !== 1) {
        throw new Error(`Unsupported translucent color "${css}" (alpha must be 1)`);
      }
    }
    return {
      r: clampChannel(parseFloat(fn[1]), css),
      g: clampChannel(parseFloat(fn[2]), css),
      b: clampChannel(parseFloat(fn[3]), css),
    };
  }

  throw new Error(`Unsupported color format "${css}"`);
}

/** sRGB channel (0–255) → linear value per WCAG 2.x. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance: L = 0.2126R + 0.7152G + 0.0722B (linearised). */
export function relativeLuminance(c: RGB): number {
  return 0.2126 * linearize(c.r) + 0.7152 * linearize(c.g) + 0.0722 * linearize(c.b);
}

/**
 * Contrast ratio (L1 + 0.05) / (L2 + 0.05), L1 the lighter. Order-independent,
 * always ≥ 1, rounded to two decimals.
 */
export function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.max(1, Math.round(ratio * 100) / 100);
}

/** One row of the audited contrast table. */
export type ContrastCase = {
  /** CSS selector of the audited text, e.g. '.metric-label'. */
  selector: string;
  /** Expected nearest opaque ancestor background, e.g. '#f2ede4'. */
  expectedBackground: string;
  /** 3 for large text (≥24px, or ≥18.66px bold), otherwise 4.5. */
  threshold: 3 | 4.5;
};

/**
 * Audited table mirroring design.md Components §A8 color table.
 * The theme `text.secondary` row has no single selector; it is covered by the
 * concrete selectors below (all backgrounds it can appear on are included).
 */
export const CONTRAST_CASES: readonly ContrastCase[] = [
  { selector: '.hero-title', expectedBackground: '#25372f', threshold: 3 },
  { selector: '.metric-label', expectedBackground: '#f2ede4', threshold: 4.5 },
  { selector: '.panel-subtitle', expectedBackground: '#fffaf2', threshold: 4.5 },
  { selector: '.territory-card span', expectedBackground: '#fffaf2', threshold: 4.5 },
  { selector: '.activity-row > span', expectedBackground: '#fffaf2', threshold: 4.5 },
  { selector: '.job-meta', expectedBackground: '#fffdf9', threshold: 4.5 },
  { selector: '.job-task', expectedBackground: '#fffdf9', threshold: 4.5 },
  { selector: '.pulse-card.warning span', expectedBackground: '#fae0d5', threshold: 4.5 },
  { selector: '.pulse-card.success span', expectedBackground: '#e1eee4', threshold: 4.5 },
  { selector: '.topbar .MuiButton-root', expectedBackground: '#fffaf2', threshold: 4.5 },
  { selector: '.risk-delta', expectedBackground: '#f2ede4', threshold: 3 },
] as const;
