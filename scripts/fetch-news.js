const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'news-data.json');
const MAX_ITEMS = 8;
const TIMEOUT_MS = 12000;

const SOURCES = {
  '金十数据': [],
  '东方财富': [],
  '联合早报': [
    'https://rsshub.app/zaobao/realtime/china',
    'https://rsshub.app/zaobao/realtime/world',
    'https://plink.anyfeeder.com/zaobao/realtime/china',
    'https://plink.anyfeeder.com/zaobao/realtime/world'
  ],
  'Reuters': [
    'https://www.reutersagency.com/feed/',
    'https://www.reuters.com/business/feed/'
  ],
  'BBC News': [
    'https://feeds.bbci.co.uk/news/rss.xml',
    'https://feeds.bbci.co.uk/news/business/rss.xml'
  ],
  'The New York Times': [
    'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'
  ],
  'The Guardian': [
    'https://www.theguardian.com/world/rss'
  ],
  'Al Jazeera': [
    'https://www.aljazeera.com/xml/rss/all.xml'
  ],
  'Financial Times': [
    'https://www.ft.com/rss/home/uk'
  ],
  'The Wall Street Journal': [
    'https://feeds.proquest.com/rss/1729935'
  ],
  'Bloomberg': [
    'https://www.bloomberg.com/authors/AV_H9K_AwSA/julia-hobsbawm.rss'
  ],
  'The Economist': [],
  'Wired': [
    'https://www.wired.com/feed/rss'
  ],
  'The Verge': [
    'https://www.theverge.com/rss/index.xml'
  ],
  'TechCrunch': [
    'https://techcrunch.com/feed/'
  ],
  'Hacker News': [
    'https://hnrss.org/frontpage?count=10'
  ],
  'Reddit': [
    'https://www.reddit.com/r/worldnews/.rss'
  ],
  'PCMag': [],
  'CNET': [
    'https://www.cnet.com/rss/news/'
  ],
  'AP': [
    'https://apnews.com/hub/ap-top-news/rss',
    'https://feeds.apnews.com/apnews/topnews'
  ],
  '雪球': [],
  'MENA': [],
  'Al Arabiya': [
    'https://www.alarabiya.net/rss/en_meast.xml'
  ],
  'Asharq Al-Awsat': [],
  'Al Ahram': []
};

function clean(s) {
  return (s || '')
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extract(block, re) {
  const m = block.match(re);
  return m ? clean(m[1]) : '';
}

function parseFeed(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < MAX_ITEMS) {
    const b = m[1];
    const title = extract(b, /<title>([\s\S]*?)<\/title>/);
    const link = extract(b, /<link>([\s\S]*?)<\/link>/);
    const date = extract(b, /<pubDate>([\s\S]*?)<\/pubDate>/);
    if (title && link) items.push({ title, link, date });
  }
  if (!items.length) {
    const re2 = /<entry>([\s\S]*?)<\/entry>/g;
    while ((m = re2.exec(xml)) && items.length < MAX_ITEMS) {
      const b = m[1];
      const lh = b.match(/<link[^>]+href="([^"]+)"/);
      const title = extract(b, /<title>([\s\S]*?)<\/title>/);
      const date = extract(b, /<updated>([\s\S]*?)<\/updated>/);
      if (title && lh) items.push({ title, link: clean(lh[1]), date });
    }
  }
  return items;
}

async function fetchText(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*'
      },
      signal: ctl.signal
    });
    if (!r.ok) return '';
    return await r.text();
  } catch (e) {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url), {
      signal: ctl.signal
    });
    const j = await r.json();
    if (j.status === 'ok' && Array.isArray(j.items)) {
      return j.items.slice(0, MAX_ITEMS).map(it => ({
        title: it.title || '',
        link: it.link || '',
        date: it.pubDate || ''
      })).filter(it => it.title && it.link);
    }
  } catch (e) {
    return [];
  } finally {
    clearTimeout(timer);
  }
  return [];
}

async function main() {
  const result = { updated: new Date().toISOString(), sources: {} };
  for (const name of Object.keys(SOURCES)) {
    const urls = SOURCES[name];
    const items = [];
    for (const url of urls) {
      if (items.length >= MAX_ITEMS) break;
      const xml = await fetchText(url);
      let parsed = xml ? parseFeed(xml) : [];
      if (!parsed.length) parsed = await fetchJson(url);
      for (const it of parsed) {
        if (items.length >= MAX_ITEMS) break;
        if (!items.some(x => x.title === it.title)) items.push(it);
      }
    }
    result.sources[name] = items;
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  const summary = Object.keys(result.sources)
    .filter(k => result.sources[k].length)
    .map(k => k + ':' + result.sources[k].length)
    .join(' ');
  console.log('UPDATED=' + result.updated);
  console.log('SOURCES=' + summary);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
