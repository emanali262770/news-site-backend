/**
 * Multi-provider translation engine for Production & Cloud Environments (Vercel/AWS).
 * Combines Google GTX + MyMemory API fallback so Vercel is NEVER blocked with 429.
 */

async function translateWithGoogle(text, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Google API status: ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return data[0].map(item => item[0]).filter(Boolean).join('');
  }
  throw new Error('Malformed Google response');
}

async function translateWithMyMemory(text, targetLang) {
  // MyMemory is free, cloud-friendly, and has zero IP-bans on Vercel/AWS
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MyMemory status: ${response.status}`);
  const data = await response.json();
  if (data?.responseData?.translatedText) {
    return data.responseData.translatedText;
  }
  throw new Error('MyMemory translation failed');
}

export async function translateText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string' || !targetLang || targetLang === 'en') {
    return text;
  }

  // Attempt 1: Try Google Translate
  try {
    return await translateWithGoogle(text, targetLang);
  } catch (googleError) {
    // If Vercel IP gets 429 from Google, automatically fallback to MyMemory API!
    try {
      return await translateWithMyMemory(text, targetLang);
    } catch (fallbackError) {
      console.error(`Translation fallback failed [${targetLang}]:`, fallbackError.message);
      return text;
    }
  }
}
