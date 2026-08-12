export interface Theme {
  primary: string;
  primaryDark: string;
  primaryLight: string;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expandHex(hex: string): string {
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
}

function hexToRgb(hex: string): [number, number, number] {
  const full = expandHex(hex);
  return [parseInt(full.slice(1, 3), 16), parseInt(full.slice(3, 5), 16), parseInt(full.slice(5, 7), 16)];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b]
    .map(clamp)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

// Blends toward black (`ratio` > 0) or white (`ratio` < 0 — reused by
// `deriveTheme`'s light tint), same simple mix used for the shipped
// `--color-primary-dark`/`--color-primary-light` pair (~20% darker,
// ~90% toward white) so a world's custom color gets the same visual
// relationship as the default palette in `styles.css`.
function mix(hex: string, target: [number, number, number], ratio: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (target[0] - r) * ratio, g + (target[1] - g) * ratio, b + (target[2] - b) * ratio]);
}

// Derives the `--color-primary-dark`/`--color-primary-light` pair from a
// single world-supplied base color, so `world.json` only needs one hex
// value instead of hand-picking a matching 3-shade set.
export function deriveTheme(primary: string): Theme {
  if (!HEX_RE.test(primary)) {
    throw new Error(`deriveTheme expects a #rgb or #rrggbb hex color, got "${primary}"`);
  }
  return {
    primary,
    primaryDark: mix(primary, [0, 0, 0], 0.22),
    primaryLight: mix(primary, [255, 255, 255], 0.88),
  };
}

export function applyTheme(theme: Theme, doc: Document = document): void {
  const root = doc.documentElement.style;
  root.setProperty('--color-primary', theme.primary);
  root.setProperty('--color-primary-dark', theme.primaryDark);
  root.setProperty('--color-primary-light', theme.primaryLight);
}
