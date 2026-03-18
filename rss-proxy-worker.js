/**
 * RSS Proxy — Cloudflare Worker
 *
 * Deploy steps:
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *   2. Choose "Create Worker", paste this entire file, click Deploy
 *   3. Copy the worker URL (e.g. https://rss-proxy.yourname.workers.dev)
 *   4. In news-aggregator.html, replace YOUR_WORKER_URL with that URL
 *
 * Usage: https://your-worker.workers.dev/?url=https://feeds.bbci.co.uk/news/rss.xml
 */

const ALLOWED_ORIGINS = ['https://haopeilin.github.io', 'http://localhost'];

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('url');

    if (!target) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    // Validate URL — only allow http/https
    let targetUrl;
    try {
      targetUrl = new URL(target);
      if (!['http:', 'https:'].includes(targetUrl.protocol)) {
        return new Response('Invalid URL protocol', { status: 400 });
      }
    } catch {
      return new Response('Invalid URL', { status: 400 });
    }

    const response = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(request),
      },
    });
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.some(o => origin.startsWith(o))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
