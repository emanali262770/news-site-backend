import mongoose from 'mongoose';
import { categoryIds } from '../constants/categories.js';

const translationSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  topic: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  content: { type: String, default: '' },
  caption: { type: String, default: '' },
}, { _id: false });

const schema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 250 },
  slug: { type: String, required: true, unique: true, immutable: true },
  categoryId: { type: String, required: true, enum: categoryIds },
  categories: {
    type: [{ type: String, enum: categoryIds }],
    default: function() {
      return this.categoryId ? [this.categoryId] : [];
    },
  },
  topic: { type: String, default: '' },
  subtitle: { type: String, required: true },
  imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', required: true },
  image: { type: String, required: true },
  imageAlt: { type: String, default: '' },
  caption: { type: String, default: '' },
  author: { type: String, required: true },
  content: { type: String, required: true },
  showOnHomepage: { type: Boolean, default: false },
  publishedAt: { type: Date, default: Date.now, immutable: true },
  readTime: { type: String, required: true },
  translations: {
    type: Map,
    of: translationSchema,
    default: () => new Map(),
  },
}, { timestamps: true });
schema.index({ publishedAt: -1, _id: -1 });
schema.index({ categoryId: 1, publishedAt: -1, _id: -1 });
schema.index({ categories: 1, publishedAt: -1, _id: -1 });
schema.index({ showOnHomepage: 1, publishedAt: -1, _id: -1 });

export default mongoose.model('Post', schema);
