export default async function handler(req) {
  const url = new URL(req.url);
  const source = url.searchParams.get('source');
  const query = url.searchParams.get('q');

  if (!source || !query) {
    return new Response(JSON.stringify({ error: 'Missing source or query' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  let leads = [];

  try {
    if (source === 'google') {
      leads = await scrapeDuckDuckGo(query);
    } else if (source === 'shopify') {
      leads = await scrapeShopify(query);
    } else if (source === 'tiktok') {
      leads = await scrapeTikTok(query);
    }
  } catch (e) {
    console.error('Scrape error:', e);
  }

  return new Response(JSON.stringify({ leads }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function scrapeDuckDuckGo(query) {
  const searchQuery = query + ' online store shop buy';
  const leads = [];
  const seen = new Set();

  // DuckDuckGo HTML search
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    }
  });

  const html = await res.text();

  // Extract result URLs and titles from DDG HTML
  const resultPattern = /<a[^>]+class="result__url"[^>]*>([^<]+)<\/a>/g;
  const titlePattern = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;

  const titles = {};
  let tm;
  while ((tm = titlePattern.exec(html)) !== null) {
    const href = tm[1];
    const title = tm[2].replace(/<[^>]+>/g, '').trim();
    if (href.includes('uddg=')) {
      try {
        const decoded = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
        const domain = new URL(decoded).hostname.replace('www.', '');
        titles[domain] = title;
      } catch(e) {}
    }
  }

  // Extract actual URLs
  const urlPattern = /uddg=(https?%3A%2F%2F[^&"]+)/g;
  let m;
  while ((m = urlPattern.exec(html)) !== null) {
    try {
      const rawUrl = decodeURIComponent(m[1]);
      const urlObj = new URL(rawUrl);
      const domain = urlObj.hostname.replace('www.', '');

      const skip = ['amazon', 'etsy', 'ebay', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'wikipedia', 'yelp', 'tripadvisor', 'linkedin', 'duckduckgo', 'google'];
      if (skip.some(s => domain.includes(s))) continue;
      if (seen.has(domain)) continue;

      seen.add(domain);
      const name = titles[domain] ? titles[domain].split(' - ')[0].split(' | ')[0].trim() : domain.split('.')[0];
      leads.push({
        name,
        website: urlObj.origin,
        domain,
        source: 'google'
      });
    } catch(e) {}
    if (leads.length >= 15) break;
  }

  return leads;
}

async function scrapeShopify(query) {
  const leads = [];
  const seen = new Set();

  // Search DuckDuckGo for Shopify stores in the niche
  const searchQuery = query + ' store shopify shop online';
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const html = await res.text();
  const urlPattern = /uddg=(https?%3A%2F%2F[^&"]+)/g;
  const titlePattern = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;

  const titles = {};
  let tm;
  while ((tm = titlePattern.exec(html)) !== null) {
    const href = tm[1];
    const title = tm[2].replace(/<[^>]+>/g, '').trim();
    if (href.includes('uddg=')) {
      try {
        const decoded = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
        const domain = new URL(decoded).hostname.replace('www.', '');
        titles[domain] = title;
      } catch(e) {}
    }
  }

  let m;
  while ((m = urlPattern.exec(html)) !== null) {
    try {
      const rawUrl = decodeURIComponent(m[1]);
      const urlObj = new URL(rawUrl);
      const domain = urlObj.hostname.replace('www.', '');

      const skip = ['amazon', 'etsy', 'ebay', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'wikipedia', 'shopify.com', 'duckduckgo'];
      if (skip.some(s => domain.includes(s))) continue;
      if (seen.has(domain)) continue;

      seen.add(domain);
      const name = titles[domain] ? titles[domain].split(' - ')[0].split(' | ')[0].trim() : domain.split('.')[0];
      leads.push({
        name,
        website: urlObj.origin,
        domain,
        source: 'shopify'
      });
    } catch(e) {}
    if (leads.length >= 10) break;
  }

  return leads;
}

async function scrapeTikTok(query) {
  const leads = [];
  const seen = new Set();

  // Search DuckDuckGo for TikTok accounts in this niche
  const searchQuery = query + ' tiktok shop brand';
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const html = await res.text();
  const urlPattern = /uddg=(https?%3A%2F%2F[^&"]+)/g;
  const titlePattern = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;

  const titles = {};
  let tm;
  while ((tm = titlePattern.exec(html)) !== null) {
    const href = tm[1];
    const title = tm[2].replace(/<[^>]+>/g, '').trim();
    if (href.includes('uddg=')) {
      try {
        const decoded = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
        const domain = new URL(decoded).hostname.replace('www.', '');
        titles[domain] = title;
      } catch(e) {}
    }
  }

  let m;
  while ((m = urlPattern.exec(html)) !== null) {
    try {
      const rawUrl = decodeURIComponent(m[1]);
      const urlObj = new URL(rawUrl);
      const domain = urlObj.hostname.replace('www.', '');

      // For TikTok source, look for brand websites found via TikTok search
      const skip = ['amazon', 'etsy', 'ebay', 'facebook', 'youtube', 'twitter', 'pinterest', 'reddit', 'wikipedia', 'duckduckgo'];
      if (skip.some(s => domain.includes(s))) continue;
      if (seen.has(domain)) continue;

      seen.add(domain);
      const name = titles[domain] ? titles[domain].split(' - ')[0].split(' | ')[0].trim() : domain.split('.')[0];
      leads.push({
        name,
        website: domain.includes('tiktok.com') ? urlObj.origin : urlObj.origin,
        domain,
        source: 'tiktok'
      });
    } catch(e) {}
    if (leads.length >= 10) break;
  }

  return leads;
}

export const config = { path: '/api/scrape' };
