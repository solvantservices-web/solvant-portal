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
      leads = await scrapeGoogle(query);
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

async function scrapeGoogle(query) {
  const searchQuery = query + ' online store buy shop -site:amazon.com -site:etsy.com -site:ebay.com';
  const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=20`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const html = await res.text();
  const leads = [];
  const seen = new Set();

  // Extract result links and titles
  const linkPattern = /<a href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>.*?<\/a>/gs;
  const titlePattern = /<h3[^>]*>(.*?)<\/h3>/gs;

  const titles = [];
  let tm;
  while ((tm = titlePattern.exec(html)) !== null) {
    titles.push(tm[1].replace(/<[^>]+>/g, '').trim());
  }

  let i = 0;
  let lm;
  while ((lm = linkPattern.exec(html)) !== null) {
    try {
      const rawUrl = decodeURIComponent(lm[1]);
      const urlObj = new URL(rawUrl);
      const domain = urlObj.hostname.replace('www.', '');

      // Skip big marketplaces and irrelevant sites
      const skip = ['amazon', 'etsy', 'ebay', 'facebook', 'instagram', 'tiktok', 'youtube', 'twitter', 'pinterest', 'reddit', 'wikipedia', 'yelp', 'tripadvisor', 'linkedin'];
      if (skip.some(s => domain.includes(s))) { i++; continue; }
      if (seen.has(domain)) { i++; continue; }

      seen.add(domain);
      const name = titles[i] ? titles[i].split(' - ')[0].split(' | ')[0].trim() : domain;
      leads.push({
        name,
        website: urlObj.origin,
        domain,
        source: 'google'
      });
    } catch(e) {}
    i++;
    if (leads.length >= 15) break;
  }

  return leads;
}

async function scrapeShopify(query) {
  const leads = [];
  const seen = new Set();

  try {
    // Search myip.ms for Shopify stores
    const res = await fetch(`https://myip.ms/browse/sites/1/ipID/23.227.38.0/ipIDii/23.227.38.255/sort/10/asc/1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      }
    });
    const html = await res.text();

    // Extract domain names
    const domainPattern = /href="https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"]*"[^>]*>[^<]*<\/a>/g;
    let m;
    while ((m = domainPattern.exec(html)) !== null) {
      const domain = m[1].replace('www.', '');
      if (seen.has(domain)) continue;
      if (domain.includes('myip') || domain.includes('shopify')) continue;

      // Check if query terms match domain or context
      const context = html.substring(Math.max(0, m.index - 200), m.index + 200).toLowerCase();
      const queryWords = query.toLowerCase().split(' ');
      const relevant = queryWords.some(w => w.length > 3 && (domain.includes(w) || context.includes(w)));

      if (relevant) {
        seen.add(domain);
        leads.push({
          name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
          website: 'https://' + domain,
          domain,
          source: 'shopify'
        });
      }
      if (leads.length >= 10) break;
    }
  } catch(e) {
    // Fallback: search Google specifically for Shopify stores
    const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query + ' site:myshopify.com OR shopify store')}&num=10`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const pattern = /https?:\/\/([a-zA-Z0-9-]+\.myshopify\.com)/g;
    let m2;
    while ((m2 = pattern.exec(html)) !== null) {
      const domain = m2[1];
      if (seen.has(domain)) continue;
      seen.add(domain);
      const name = domain.replace('.myshopify.com', '');
      leads.push({ name, website: 'https://' + domain, domain, source: 'shopify' });
      if (leads.length >= 10) break;
    }
  }

  return leads;
}

async function scrapeTikTok(query) {
  const leads = [];
  const seen = new Set();

  try {
    const res = await fetch(`https://www.tiktok.com/search/user?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();

    // Extract user data from TikTok's embedded JSON
    const jsonMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1]);
      const users = data?.__DEFAULT_SCOPE__?.['webapp.search-result']?.data?.users || [];
      users.forEach(u => {
        const user = u.user_info || u;
        const username = user.unique_id || user.uniqueId;
        const nickname = user.nickname;
        const bio = user.signature || '';
        const followers = user.follower_count || user.followerCount || 0;

        if (!username || seen.has(username)) return;

        // Check if they have a website link in bio (suggests e-commerce)
        const hasLink = bio.includes('http') || bio.includes('www') || bio.includes('.com') || bio.includes('shop') || bio.includes('link');

        if (hasLink || followers > 1000) {
          seen.add(username);
          // Try to extract website from bio
          const urlMatch = bio.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/);
          const website = urlMatch ? urlMatch[0].replace('www.', 'https://www.') : '';

          leads.push({
            name: nickname || username,
            website: website || 'https://www.tiktok.com/@' + username,
            domain: website ? new URL(website.startsWith('http') ? website : 'https://' + website).hostname.replace('www.','') : username + ' (TikTok)',
            tiktokHandle: username,
            followers,
            source: 'tiktok'
          });
        }
        if (leads.length >= 10) return;
      });
    }
  } catch(e) {
    console.error('TikTok error:', e);
  }

  return leads;
}

export const config = { path: '/api/scrape' };
