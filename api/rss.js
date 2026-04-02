// api/rss.js — Vercel Serverless Function
// 브라우저 대신 서버에서 RSS를 수집하고 JSON으로 반환합니다.

const RSS_SOURCES = {
  hankyung:   'https://www.hankyung.com/feed/all-news',
  mk:         'https://www.mk.co.kr/rss/40300001/',
  edaily:     'https://rss.edaily.co.kr/edaily/section/economy.xml',
  yonhap:     'https://www.yonhapnewstv.co.kr/browse/feed/',
  biz:        'https://biz.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
  sedaily:    'https://www.sedaily.com/RSS/V7.xml',
  etnews:     'https://rss.etnews.com/Section901.xml',
  yonhap_all: 'https://www.yonhapnews.co.kr/RSS/headline.xml',
  chosun:     'https://www.chosun.com/arc/outboundfeeds/rss/?outputType=xml',
  joongang:   'https://rss.joins.com/joins_news_list.xml',
  donga:      'https://rss.donga.com/total.xml',
  kbs:        'https://world.kbs.co.kr/rss/rss_news.htm?lang=k',
  mbc:        'https://imnews.imbc.com/rss/news/news_00.xml',
  sbs:        'https://news.sbs.co.kr/news/newsflash.do?plink=rss&cooper=sbs&division=01',
};

// Node.js 환경용 정규식 RSS 파서 (DOMParser 대체)
function parseRSS(xml, sourceKey) {
  const items  = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const titleRe = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i;
  const linkRe  = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i;
  const guidRe  = /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i;
  let match;

  while ((match = itemRe.exec(xml)) !== null && items.length < 40) {
    const block       = match[0];
    const titleMatch  = titleRe.exec(block);
    const linkMatch   = linkRe.exec(block);
    const guidMatch   = guidRe.exec(block);

    const title = (titleMatch?.[1] || '').trim()
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"');
    const link  = (linkMatch?.[1] || guidMatch?.[1] || '#').trim();

    if (title && title.length > 3) {
      items.push({ title, link, source: sourceKey });
    }
  }
  return items;
}

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const requested = (req.query.sources || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!requested.length)
    return res.status(400).json({ success: false, error: 'sources 파라미터 필요' });

  const results     = [];
  const sourceStats = {};
  const errors      = {};

  // 병렬 수집
  await Promise.allSettled(
    requested.map(async (key) => {
      const url = RSS_SOURCES[key];
      if (!url) return;

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MorningBriefBot/1.0)' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const xml   = await response.text();
        const items = parseRSS(xml, key);
        results.push(...items);
        sourceStats[key] = { count: items.length, ok: items.length > 0 };
      } catch (e) {
        console.error(`[${key}] 수집 에러:`, e.message);
        sourceStats[key] = { count: 0, ok: false };
        errors[key]      = e.message;
      }
    })
  );

  res.status(200).json({
    success:     true,
    items:       results,
    sourceStats,
    errors,
    total:       results.length,
    fetchedAt:   new Date().toISOString(),
  });
}
