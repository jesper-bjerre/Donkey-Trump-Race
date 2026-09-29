/**
 * Colour tokens for menus, lobby, results and HUD. `tokens.css` mirrors these values as
 * CSS custom properties; `accessibilityTokens.test.ts` keeps them in sync and verifies
 * WCAG 2.1 AA contrast for every foreground/background pair the UI uses.
 */
export const COLOR_TOKENS = {
  bg: '#0e1030',
  bg2: '#1a1f5c',
  surface: '#1c2150',
  surface2: '#262c66',
  text: '#f5f6ff',
  muted: '#b8bde6',
  accent: '#ffcc00',
  accentText: '#1a1400',
  danger: '#ff6b6b',
  dangerText: '#ffd1d1',
  success: '#69f0ae',
  focus: '#80d8ff',
} as const;

export type ColorToken = keyof typeof COLOR_TOKENS;

/** CSS custom property name for a token (`surface2` -> `--surface-2`). */
export function cssVarName(token: ColorToken): string {
  return `--${token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`;
}

export interface ContrastPair {
  foreground: ColorToken;
  background: ColorToken;
  /** 4.5 for body text, 3 for large text and UI components such as focus rings. */
  minimum: 4.5 | 3;
  usage: string;
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  { foreground: 'text', background: 'bg', minimum: 4.5, usage: 'body text' },
  { foreground: 'text', background: 'surface', minimum: 4.5, usage: 'card text' },
  { foreground: 'text', background: 'surface2', minimum: 4.5, usage: 'raised card text' },
  { foreground: 'muted', background: 'surface', minimum: 4.5, usage: 'hints on cards' },
  { foreground: 'muted', background: 'surface2', minimum: 4.5, usage: 'hints on raised cards' },
  { foreground: 'muted', background: 'bg', minimum: 4.5, usage: 'fine print' },
  { foreground: 'accentText', background: 'accent', minimum: 4.5, usage: 'primary buttons' },
  { foreground: 'focus', background: 'surface', minimum: 4.5, usage: 'link buttons' },
  { foreground: 'focus', background: 'bg', minimum: 3, usage: 'focus ring' },
  { foreground: 'dangerText', background: 'surface', minimum: 4.5, usage: 'error text' },
  { foreground: 'danger', background: 'surface', minimum: 3, usage: 'invalid field border' },
  { foreground: 'success', background: 'surface', minimum: 4.5, usage: 'ready badge' },
  { foreground: 'accent', background: 'surface', minimum: 4.5, usage: 'room code' },
];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** WCAG 2.1 contrast ratio between two opaque colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
