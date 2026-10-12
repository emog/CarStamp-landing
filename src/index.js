/**
 * CarStamp website Worker: wraps Workers Static Assets to
 *   - apply security headers to every response,
 *   - apply tiered cache headers (images and fonts immutable, text files a day at the edge,
 *     pages a short browser cache with a longer edge cache),
 *   - send http and www.carstamp.app to https://carstamp.app with a permanent redirect, so the site has
 *     one address,
 *   - answer scanner probes and repo-internal paths with a plain 404.
 * Trailing slashes and the 404 page are handled by [assets] in wrangler.toml.
 */

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-Frame-Options': 'DENY',
};

const CANONICAL_HOST = 'carstamp.app';

const IMG_EXT = /\.(png|jpe?g|gif|svg|webp|ico|avif)$/i;
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;
const HTML_LIKE = /\.(html?|xml|txt|json)$/i;

// The asset folder holds only the built site; this is defense in depth against a future accidental
// include, and it hands scanners a clean 404.
function isBlockedPath(pathname) {
  if (pathname === '/.git' || pathname.startsWith('/.git/')) return true;
  if (pathname.startsWith('/.wrangler')) return true;
  if (pathname === '/wrangler.toml') return true;
  if (pathname.startsWith('/src/')) return true;
  if (/(^|\/)\.env(\.[^/]*)?$/.test(pathname)) return true;
  if (/\.php$/i.test(pathname)) return true;
  return false;
}

function cacheControlFor(pathname) {
  if (IMG_EXT.test(pathname) || FONT_EXT.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }
  if (pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/llms.txt' || pathname === '/llms-full.txt') {
    return 'public, max-age=3600, s-maxage=86400';
  }
  if (HTML_LIKE.test(pathname) || !pathname.includes('.')) {
    return 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800';
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only the site's own hosts; a workers.dev preview address is served as it is.
    const isWww = url.hostname === 'www.' + CANONICAL_HOST;
    if (isWww || (url.hostname === CANONICAL_HOST && url.protocol === 'http:')) {
      return new Response(null, {
        status: 301,
        headers: { ...SECURITY_HEADERS, Location: `https://${CANONICAL_HOST}${url.pathname}${url.search}` },
      });
    }

    if (isBlockedPath(url.pathname)) {
      return new Response('Not Found', {
        status: 404,
        headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    const cacheControl = cacheControlFor(url.pathname);
    if (cacheControl && response.status === 200) {
      headers.set('Cache-Control', cacheControl);
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
