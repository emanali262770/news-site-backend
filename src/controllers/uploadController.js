import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import Image from '../models/Image.js';
import { config } from '../config.js';
import { fail } from '../utils/errors.js';

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
  await mkdir(config.uploads, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  const filePath = path.join(config.uploads, filename);
  await writeFile(filePath, buffer, { flag: 'wx' });
  let image;
  try {
    image = await Image.create({ url: `/uploads/${filename}` });
  } catch (error) {
    // Remove the file if its database record could not be saved.
    await unlink(filePath).catch(() => {});
    throw error;
  }
  res.status(201).json({ id: image.id, url: image.url });
}
