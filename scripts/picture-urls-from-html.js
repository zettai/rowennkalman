/** @typedef {string} ArtPictureUrl */

const ART_URL =
  /^https:\/\/img\.rowennkalman\.com\/art\/[^/?#]+\.(?:webp|jpg)$/i;

const TAG_RE = /<(?:img|link)\b[^>]*>/gi;
const REL_RE = /\brel\s*=\s*["']([^"']*)["']/i;
const ATTR_RE = /\b(src|srcset|imagesrcset)\s*=\s*["']([^"']*)["']/gi;

/**
 * @param {string} value
 */
function decodeAmp(value) {
  return value.includes("&amp;") ? value.replaceAll("&amp;", "&") : value;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isArtPictureUrl(raw) {
  return ART_URL.test(decodeAmp(raw.trim()));
}

/**
 * @param {string} raw
 * @returns {ArtPictureUrl | undefined}
 */
function normalizeArtUrl(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const url = decodeAmp(trimmed);
  return isArtPictureUrl(url) ? /** @type {ArtPictureUrl} */ (url) : undefined;
}

/**
 * @param {string} srcset
 * @returns {string[]}
 */
function urlsFromSrcset(srcset) {
  const out = [];
  for (const part of srcset.split(",")) {
    const token = part.trim().split(/\s+/)[0];
    if (token) out.push(token);
  }
  return out;
}

/**
 * @param {string} tag
 */
function isPreloadLinkTag(tag) {
  if (!/^<link\b/i.test(tag)) return false;
  const rel = REL_RE.exec(tag)?.[1];
  if (!rel) return false;
  return rel.split(/\s+/).some((token) => token.toLowerCase() === "preload");
}

/**
 * Collect distinct art CDN picture URLs referenced by public page HTML.
 *
 * @param {string} html
 * @returns {ArtPictureUrl[]}
 */
export function pictureUrlsFromHtml(html) {
  /** @type {Set<ArtPictureUrl>} */
  const seen = new Set();
  /** @type {ArtPictureUrl[]} */
  const ordered = [];

  /**
   * @param {string} raw
   */
  const push = (raw) => {
    const url = normalizeArtUrl(raw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    ordered.push(url);
  };

  TAG_RE.lastIndex = 0;
  let tagMatch;
  while ((tagMatch = TAG_RE.exec(html)) !== null) {
    const tag = tagMatch[0];
    const isImg = /^<img\b/i.test(tag);
    if (!isImg && !isPreloadLinkTag(tag)) continue;

    ATTR_RE.lastIndex = 0;
    let attrMatch;
    while ((attrMatch = ATTR_RE.exec(tag)) !== null) {
      const name = attrMatch[1].toLowerCase();
      const value = attrMatch[2];
      if (name === "src") push(value);
      else {
        for (const candidate of urlsFromSrcset(value)) push(candidate);
      }
    }
  }

  return ordered;
}
