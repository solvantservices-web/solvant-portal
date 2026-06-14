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
      leads = await scrapeBing(query + ' online store buy shop -site:amazon.com -site:etsy.com -site:ebay.com');
    } else if (source === 'shopify') {
      leads = await scrapeBing(query + ' site:myshopify.com OR inurl:shopify', 'shopify');
    } else if (source === 'tiktok') {
      leads = await scrapeBing(query + ' shop brand store tiktok -site:tiktok.com', 'tiktok');
    }
  } catch (e) {
    console.error('Scrape error:', e);
  }

  return new Response(JSON.stringify({ leads }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function scrapeBing(query, source = 'google') {
  const leads = [];
  const seen = new Set();

  const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  const html = await res.text();

  // Extract titles and URLs from Bing results
  // Bing result links are in <h2><a href="..."> format
  const resultPattern = /<h2[^>]*><a[^>]+href="(https?:\/\/[^"]+)"[^>]*>(.*?)<\/a><\/h2>/g;
  let m;

  while ((m = resultPattern.exec(html)) !== null) {
    try {
      const rawUrl = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      const urlObj = new URL(rawUrl);
      const domain = urlObj.hostname.replace('www.', '');

      const skip = ['amazon', 'etsy', 'ebay', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'wikipedia', 'yelp', 'tripadvisor', 'linkedin', 'bing', 'microsoft', 'google'];
      if (skip.some(s => domain.includes(s))) continue;
      if (seen.has(domain)) continue;

      seen.add(domain);
      const name = title.split(' - ')[0].split(' | ')[0].trim() || domain.split('.')[0];

      leads.push({
        name,
        website: urlObj.origin,
        domain,
        source
      });
    } catch(e) {}
    if (leads.length >= 12) break;
  }

  return leads;
}

export const config = { path: '/api/scrape' };
