import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

schema.index({ isActive: 1 });

export default mongoose.model('Subscriber', schema);
