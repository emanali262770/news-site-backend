import mongoose from 'mongoose';

export default mongoose.model('Image', new mongoose.Schema({
  url: { type: String, required: true },
}, { timestamps: true }));
