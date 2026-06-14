export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const result = {
    instagram: null,
    email: null,
    followers: null,
    lastPostDate: null,
    hasReels: null,
    problem: null,
    product: null
  };

  try {
    // Step 1: Visit the store website and extract instagram + email
    const siteRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    const html = await siteRes.text();

    // Extract Instagram handle
    const igPatterns = [
      /instagram\.com\/([a-zA-Z0-9._]+)/g,
      /instagram\.com\/@([a-zA-Z0-9._]+)/g
    ];

    for (const pattern of igPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const m of matches) {
        const handle = m[1].replace(/['">\s\/]/g, '');
        // Skip generic instagram paths
        const skip = ['p', 'reel', 'stories', 'explore', 'accounts', 'about', 'legal', 'share', 'tv'];
        if (handle && !skip.includes(handle) && handle.length > 1) {
          result.instagram = handle;
          break;
        }
      }
      if (result.instagram) break;
    }

    // Extract email
    const emailPattern = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
    const emails = [...html.matchAll(emailPattern)].map(m => m[1]);
    const filtered = emails.filter(e => {
      const skip = ['example', 'test', 'noreply', 'no-reply', 'support@shopify', 'cdn', 'sentry', 'pixel'];
      return !skip.some(s => e.includes(s));
    });
    if (filtered.length > 0) result.email = filtered[0];

    // Extract product hints from title/meta
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) result.product = titleMatch[1].replace(/\s*[-|–]\s*.*/,'').trim().substring(0, 60);

    // Step 2: If we found an Instagram handle, visit their IG page
    if (result.instagram) {
      try {
        const igRes = await fetch(`https://www.instagram.com/${result.instagram}/`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });

        const igHtml = await igRes.text();

        // Extract follower count from meta or JSON
        const followersMatch = igHtml.match(/"edge_followed_by":\{"count":(\d+)\}/) ||
                               igHtml.match(/(\d[\d,]+)\s*[Ff]ollowers/) ||
                               igHtml.match(/"follower_count":(\d+)/);
        if (followersMatch) {
          result.followers = parseInt(followersMatch[1].replace(/,/g, ''));
        }

        // Extract last post date
        const dateMatch = igHtml.match(/"taken_at_timestamp":(\d+)/) ||
                          igHtml.match(/"date":"([^"]+)"/) ||
                          igHtml.match(/datetime="([^"]+)"/);
        if (dateMatch) {
          const ts = parseInt(dateMatch[1]);
          const date = ts > 1000000000 ? new Date(ts * 1000) : new Date(dateMatch[1]);
          result.lastPostDate = date.toISOString().split('T')[0];

          // Calculate days since last post
          const daysSince = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

          // Detect problem
          if (daysSince > 30) {
            result.problem = 'inactive | since ' + date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          }
        }

        // Check for reels
        const hasReels = igHtml.includes('"product_type":"clips"') || igHtml.includes('"is_video":true') || igHtml.includes('/reel/');
        result.hasReels = hasReels;

        if (!result.problem && !hasReels) {
          result.problem = 'no reels | NULL';
        }

      } catch(e) {
        console.error('Instagram fetch error:', e);
      }
    }

  } catch(e) {
    console.error('Enrich error:', e);
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export const config = { path: '/api/enrich' };
