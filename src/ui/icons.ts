// Small hand-authored inline icon set — no external icon font, no CDN, no
// asset files to fetch. Each icon is a self-contained SVG string sized by
// its viewBox; callers set width/height via CSS.
export const icons = {
  search:
    '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>',
  close:
    '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24"><path d="m5 5 14 14m0-14L5 19"/></svg>',
  filter:
    '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h16l-6 8v7l-4 2v-9z"/></svg>',
  layers:
    '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/><path d="m3 17.5 9 5 9-5"/></svg>',
  chevron:
    '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  pushpin:
    '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5c0 3 2 4.5 3 7l-3 3v1h10v-1l-3-3c1-2.5 3-4 3-7a5 5 0 0 0-5-5m0 15v5"/></svg>',
  edit: '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
} as const;
