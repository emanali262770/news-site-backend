import translate from '@iamtraction/google-translate';

/**
 * Translates text into the target language.
 * Falls back to original text if translation fails or target is English.
 * 
 * @param {string} text - Text to translate
 * @param {string} targetLang - Language code e.g. 'ur', 'hi', 'ar', 'es'
 * @returns {Promise<string>}
 */
export async function translateText(text, targetLang = 'en') {
  if (!text || typeof text !== 'string' || !targetLang || targetLang === 'en') {
    return text;
  }

  try {
    const res = await translate(text, { to: targetLang });
    return res.text;
  } catch (error) {
    console.error(`Translation error for [${targetLang}]:`, error.message);
    return text;
  }
}
