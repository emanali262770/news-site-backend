import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import Image from '../models/Image.js';
import { config } from '../config.js';
import { fail } from '../utils/errors.js';

if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'news-site',
        resource_type: 'image',
        format: 'webp',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

export async function upload(req, res) {
  if (!req.file) throw fail(400, 'Image is required');
  let buffer;
  try {
    const image = sharp(req.file.buffer, { limitInputPixels: 25000000, failOn: 'warning' });
    const metadata = await image.metadata();
    const supportedFormat = ['jpeg', 'png', 'webp'].includes(metadata.format);
    const animated = (metadata.pages || 1) > 1;
    if (!supportedFormat || animated) {
      throw new Error('Unsupported image');
    }
    buffer = await image.rotate().webp({ quality: 85 }).toBuffer();
  } catch {
    throw fail(400, 'Upload a valid, non-animated JPG, PNG or WebP image (maximum 25 megapixels)');
  }

  let imageUrl;

  // If Cloudinary credentials are provided, upload directly to Cloudinary (Production & Vercel safe)
  if (config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret) {
    try {
      const result = await uploadToCloudinary(buffer);
      imageUrl = result.secure_url;
    } catch (err) {
      console.error('Cloudinary upload error:', err.message);
      throw fail(500, 'Failed to upload image to cloud storage');
    }
  } else {
    // Fallback to local storage (for offline local development)
    await mkdir(config.uploads, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    const filePath = path.join(config.uploads, filename);
    await writeFile(filePath, buffer, { flag: 'wx' });
    imageUrl = `/uploads/${filename}`;
  }

  const image = await Image.create({ url: imageUrl });
  res.status(201).json({ id: image.id, url: image.url });
}
