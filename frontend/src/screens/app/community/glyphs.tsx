/** Small inline glyphs the shared Icon set does not provide. */

export function CommentGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2c5 0 9 3.4 9 7.6s-4 7.6-9 7.6a10.6 10.6 0 0 1-2.6-.3l-4.1 2 1-3.6A7.2 7.2 0 0 1 3 10.8c0-4.2 4-7.6 9-7.6Z" fill="currentColor" />
    </svg>
  );
}

export function MoreGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}