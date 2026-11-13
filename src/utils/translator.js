/**
 * Production-ready Google Translate Engine using official Chromium GTX API.
 * High performance, zero unnecessary overhead, bypasses AWS/Vercel scraping bans (429).
 */

const GOOGLE_API_URL = 'https://translate.googleapis.com/translate_a/single';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function translateText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string' || !targetLang || targetLang === 'en') {
    return text;
  }

  try {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'auto',
      tl: targetLang,
      dt: 't',
      q: text,
    });

    const response = await fetch(`${GOOGLE_API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Google API status: ${response.status}`);
      return text;
    }

    const data = await response.json();
    
    // Google returns nested arrays of translation chunks: [[['ترجمہ', 'original', ...]]]
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0].map(item => item[0]).filter(Boolean).join('');
    }

    return text;
  } catch (error) {
    console.error(`Translation error [${targetLang}]:`, error.message);
    return text;
  }
}
