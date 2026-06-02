// Resolve a path to a file in /public against Vite's base URL. Needed because
// the site is served from a GitHub Pages subpath (/passnokkel/), so a bare
// "/icon.png" would resolve to the domain root and 404. import.meta.env.BASE_URL
// is "/passnokkel/" in production and "/" in tests/other bases.
export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
