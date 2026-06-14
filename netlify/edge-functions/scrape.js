const SERP_API_KEY = '75c3219949559a1dd695695ccf81039018f703d24c8c48d836a0869f6e940d52';

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
      leads = await searchSerpApi(query + ' online store shop buy -site:amazon.com -site:etsy.com -site:ebay.com', 'google');
    } else if (source === 'shopify') {
      leads = await searchSerpApi(query + ' store site:myshopify.com', 'shopify');
    } else if (source === 'tiktok') {
      leads = await searchSerpApi(query + ' brand shop store -site:tiktok.com -site:amazon.com', 'tiktok');
    }
  } catch (e) {
    console.error('Scrape error:', e);
  }

  return new Response(JSON.stringify({ leads }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function searchSerpApi(query, source) {
  const params = new URLSearchParams({
    api_key: SERP_API_KEY,
    engine: 'google',
    q: query,
    num: '10',
    hl: 'en',
    gl: 'us'
  });

  const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
  const data = await res.json();

  if (!data.organic_results) return [];

  const skip = ['amazon', 'etsy', 'ebay', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'wikipedia', 'yelp', 'tripadvisor', 'linkedin'];
  const seen = new Set();
  const leads = [];

  for (const result of data.organic_results) {
    try {
      const urlObj = new URL(result.link);
      const domain = urlObj.hostname.replace('www.', '');

      if (skip.some(s => domain.includes(s))) continue;
      if (seen.has(domain)) continue;
      seen.add(domain);

      leads.push({
        name: result.title.split(' - ')[0].split(' | ')[0].trim(),
        website: urlObj.origin,
        domain,
        source
      });
    } catch(e) {}
    if (leads.length >= 10) break;
  }

  return leads;
}

export const config = { path: '/api/scrape' };
