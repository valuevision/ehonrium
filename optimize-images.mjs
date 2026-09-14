import sharp from 'sharp';
import { readdir, stat, mkdir } from 'fs/promises';
import { join, extname, basename } from 'path';

const ROOT = '.';
const ILLUST_DIR = join(ROOT, 'イラスト');

// Max dimensions per category
const HERO_MAX = 1600;     // Hero background images
const ILLUST_MAX = 800;    // Illustrations (displayed at max ~440px, 2x for retina)
const LOGO_MAX = 400;      // Logo
const ICON_MAX = 180;      // Favicon, apple-touch-icon

async function getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...await getFiles(fullPath));
    } else if (entry.isFile() && /\.(png|jpg|jpeg)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function getMaxDimension(filePath) {
  const name = basename(filePath).toLowerCase();
  if (name.includes('favicon') || name.includes('apple-touch')) return ICON_MAX;
  if (name.includes('ロゴ') || name.includes('logo')) return LOGO_MAX;
  if (name.includes('参考画像') || name.includes('ogp')) return HERO_MAX;
  return ILLUST_MAX;
}

async function optimizeImage(filePath) {
  const maxDim = getMaxDimension(filePath);
  const ext = extname(filePath).toLowerCase();
  const nameWithoutExt = filePath.slice(0, -ext.length);
  const outputPath = nameWithoutExt + '.webp';

  try {
    const metadata = await sharp(filePath).metadata();
    const originalSize = (await stat(filePath)).size;

    let pipeline = sharp(filePath);

    // Resize if larger than max dimension
    if (metadata.width > maxDim || metadata.height > maxDim) {
      pipeline = pipeline.resize(maxDim, maxDim, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to WebP
    const quality = filePath.includes('参考画像') ? 82 : 80;
    await pipeline.webp({ quality, effort: 6 }).toFile(outputPath);

    const newSize = (await stat(outputPath)).size;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(1);
    console.log(`✓ ${filePath} → ${(originalSize/1024).toFixed(0)}KB → ${(newSize/1024).toFixed(0)}KB (${reduction}% reduced)`);
    return { original: originalSize, optimized: newSize };
  } catch (err) {
    console.error(`✗ ${filePath}: ${err.message}`);
    return { original: 0, optimized: 0 };
  }
}

async function main() {
  const files = await getFiles(ROOT);
  console.log(`Found ${files.length} image files to optimize\n`);

  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const file of files) {
    const result = await optimizeImage(file);
    totalOriginal += result.original;
    totalOptimized += result.optimized;
  }

  console.log(`\n========================================`);
  console.log(`Total: ${(totalOriginal/1024/1024).toFixed(1)}MB → ${(totalOptimized/1024/1024).toFixed(1)}MB`);
  console.log(`Reduction: ${((1 - totalOptimized/totalOriginal) * 100).toFixed(1)}%`);
  console.log(`========================================`);
}

main();
