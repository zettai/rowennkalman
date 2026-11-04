/** Cache tag on every public page; the save route purges it. Keep in sync with next.config.ts headers. */
export const PAGE_CACHE_TAG = "rk-pages";

/** Public pages stay on Netlify's CDN until the next admin save purges the tag. */
export const PAGE_CDN_SECONDS = 31536000;

export const PUBLIC_PAGE_PATHS = ["/", "/about", "/portfolio", "/research", "/contact"] as const;

/** Warm-cache requests mimic common browser Accept-Encoding values. */
export const REFRESH_ACCEPT_ENCODINGS = ["gzip, deflate, br, zstd", "gzip, deflate, br"] as const;

export const REFRESH_USER_AGENT = "rowennkalman-page-refresh/1";
