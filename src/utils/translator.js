import translate from '@iamtraction/google-translate';

/**
 * Translates a single chunk of text under 1500 chars
 */
async function translateChunk(chunk, targetLang) {
  if (!chunk || !chunk.trim()) return chunk;
  try {
    const res = await translate(chunk, { to: targetLang });
    return res.text;
  } catch (error) {
    console.error(`Translation chunk error for [${targetLang}]:`, error.message);
    return chunk;
  }
}

/**
 * Translates text into the target language.
 * Automatically splits long articles by paragraphs so Google Translate limits are never exceeded.
 * 
 * @param {string} text - Text to translate
 * @param {string} targetLang - Language code e.g. 'ur', 'hi', 'ar', 'es'
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string' || !targetLang || targetLang === 'en') {
    return text;
  }

  // Short text (title, subtitle, topic, caption): translate directly
  if (text.length <= 1500) {
    return translateChunk(text, targetLang);
  }

  // Long text (full news article): split by paragraphs (\n\n) to preserve layout and stay under request limits
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
  if (currentBatch) {
    batches.push(currentBatch);
  }

  try {
    const translatedBatches = await Promise.all(
      batches.map(batch => translateChunk(batch, targetLang))
    );
    return translatedBatches.join('\n\n');
  } catch (error) {
    console.error(`Batch translation error for [${targetLang}]:`, error.message);
    return text;
  }
}
