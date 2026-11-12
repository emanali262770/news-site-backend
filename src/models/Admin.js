import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: { type: String, default: 'admin', enum: ['admin'] },
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true });

export default mongoose.model('Admin', schema);
