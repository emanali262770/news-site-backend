import translate from '@iamtraction/google-translate';

/**
 * Waits for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Translates a single chunk of text with retry on 429 (rate limit).
 */
async function translateChunk(chunk, targetLang, retries = 2) {
  if (!chunk || !chunk.trim()) return chunk;
  try {
    const res = await translate(chunk, { to: targetLang });
    return res.text;
  } catch (error) {
    const isRateLimit = error?.code === 429 || error?.message?.includes('429');
    if (isRateLimit && retries > 0) {
      // Wait 1 second then retry
      await sleep(1000);
      return translateChunk(chunk, targetLang, retries - 1);
    }
    console.error(`Translation chunk error for [${targetLang}]:`, error.message);
    return chunk; // fallback to original
  }
}

/**
 * Translates text into the target language.
 * - Short text (title, subtitle, topic, caption): translated directly.
 * - Long text (full article): split into paragraphs and translated sequentially
 *   with a small delay between each to avoid Google rate limits (429).
 *
 * @param {string} text - Text to translate
 * @param {string} targetLang - Language code e.g. 'ur', 'hi', 'ar', 'es'
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string' || !targetLang || targetLang === 'en') {
    return text;
  }

  // Short text: translate in one request
  if (text.length <= 1500) {
    return translateChunk(text, targetLang);
  }

  // Long text: split into paragraph batches of max 1500 chars each
  const paragraphs = text.split('\n\n');
  const batches = [];
  let currentBatch = '';

  for (const para of paragraphs) {
    if (!currentBatch) {
      currentBatch = para;
    } else if ((currentBatch.length + para.length + 2) < 1500) {
      currentBatch += `\n\n${para}`;
    } else {
      batches.push(currentBatch);
      currentBatch = para;
    }
  }
  if (currentBatch) batches.push(currentBatch);

  // Translate sequentially (one by one) with 300ms gap to avoid rate limits
  const translatedBatches = [];
  for (const batch of batches) {
    const result = await translateChunk(batch, targetLang);
    translatedBatches.push(result);
    if (batches.length > 1) await sleep(300); // small delay between batches
  }

  return translatedBatches.join('\n\n');
}
