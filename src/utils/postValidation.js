import { categoryIds } from '../constants/categories.js';
import { fail } from './errors.js';

const textLimits = {
  title: 250,
  categoryId: 40,
  topic: 200,
  subtitle: 2000,
  imageId: 24,
  imageAlt: 500,
  caption: 1000,
  author: 200,
  content: 200000,
};
const requiredFields = ['title', 'categoryId', 'subtitle', 'imageId', 'author', 'content'];

export function validatePost(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Post fields are required');
  const values = {};
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(textLimits, key) && key !== 'showOnHomepage' && key !== 'categories' && key !== 'categoryIds') {
      throw fail(400, `Unknown field: ${key}`);
    }
  }

  // Handle multiple categoryIds / categories array
  const rawCategories = body.categories || body.categoryIds;
  if (rawCategories !== undefined) {
    if (!Array.isArray(rawCategories)) throw fail(400, 'categories must be an array');
    const cleanedCategories = rawCategories.map(c => typeof c === 'string' ? c.trim() : '').filter(Boolean);
    for (const cat of cleanedCategories) {
      if (!categoryIds.includes(cat)) throw fail(400, `Invalid category: ${cat}`);
    }
    if (!partial && cleanedCategories.length === 0) {
      throw fail(400, 'At least one category is required');
    }
    values.categories = cleanedCategories;
    if (cleanedCategories.length > 0 && !body.categoryId) {
      values.categoryId = cleanedCategories[0];
    }
  }

  for (const [key, max] of Object.entries(textLimits)) {
    if (body[key] === undefined) {
      if (!partial && requiredFields.includes(key)) {
        // If categoryId is missing but categories array provided, don't fail
        if (key === 'categoryId' && values.categoryId) continue;
        throw fail(400, `${key} is required`);
      }
      continue;
    }
    if (typeof body[key] !== 'string') throw fail(400, `${key} must be text`);
    const value = body[key].trim();
    if (value.length > max || (requiredFields.includes(key) && !value)) throw fail(400, `Invalid ${key}`);
    values[key] = value;
  }
  if (values.categoryId && !categoryIds.includes(values.categoryId)) throw fail(400, 'Invalid categoryId');
  if (values.categories && values.categories.length > 0 && !values.categoryId) {
    values.categoryId = values.categories[0];
  } else if (values.categoryId && (!values.categories || values.categories.length === 0)) {
    values.categories = [values.categoryId];
  }
  if (values.imageId && !/^[a-f\d]{24}$/i.test(values.imageId)) throw fail(400, 'Invalid imageId');
  if (body.showOnHomepage !== undefined) {
    if (typeof body.showOnHomepage !== 'boolean') throw fail(400, 'showOnHomepage must be a boolean');
    values.showOnHomepage = body.showOnHomepage;
  }
  if (partial && !Object.keys(values).length) throw fail(400, 'At least one field is required');
  return values;
}

function parsePositiveInteger(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw fail(400, 'Invalid pagination');
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) {
    throw fail(400, 'Invalid pagination');
  }
  return number;
}

export function listFilter(query) {
  const page = parsePositiveInteger(query.page, 1, 1000000);
  const limit = parsePositiveInteger(query.limit, 10, 100);
  const filter = {};
  if (query.category !== undefined) {
    if (!categoryIds.includes(query.category)) throw fail(400, 'Invalid category');
    filter.categoryId = query.category;
  }
  if (query.homepage !== undefined) {
    if (!['true', 'false'].includes(query.homepage)) throw fail(400, 'Invalid homepage filter');
    filter.showOnHomepage = query.homepage === 'true';
  }
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 200) throw fail(400, 'Invalid search');
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) filter.$or = ['title', 'subtitle', 'topic', 'content'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } }));
  }
  return { page, limit, filter };
}
