export const categories = ['pakistan', 'articles', 'world', 'business', 'sports', 'technology', 'health', 'entertainment', 'education', 'lifestyle']
  .map(id => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
export const categoryIds = categories.map(category => category.id);
