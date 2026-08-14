require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const Image = require('../src/models/Image');
const { uploadFromPath } = require('../src/services/imagekitClient');

const MONGO = process.env.MONGO_URL || 'mongodb://localhost:27017/image_pipeline';

async function uploadIfExists(localPath, folder) {
  try {
    if (!localPath) return null;
    if (!fs.existsSync(localPath)) return null;
    const res = await uploadFromPath(localPath, folder);
    return res && res.url ? res.url : null;
  } catch (err) {
    console.warn('Upload failed for', localPath, err && err.message ? err.message : err);
    return null;
  }
}

async function main() {
  console.log('Connecting to Mongo:', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

  // Find images without fileUrl
  const cursor = Image.find({ $or: [ { fileUrl: { $exists: false } }, { fileUrl: null } ] }).cursor();
  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    count++;
    console.log(`Processing ${count}: ${doc.processingId} (${doc.originalFilename})`);

    // Original file
    const origPath = path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath);
    const origUrl = await uploadIfExists(origPath, '/uploads');
    if (origUrl) {
      doc.fileUrl = origUrl;
      console.log('  Uploaded original ->', origUrl);
    } else {
      console.log('  Original not found or upload failed:', origPath);
    }

    // OCR crop
    const cropPathRaw = doc.analysis && doc.analysis.plate && doc.analysis.plate.ocrCrop && doc.analysis.plate.ocrCrop.path;
    if (cropPathRaw) {
      const cropPath = path.isAbsolute(cropPathRaw) ? cropPathRaw : path.join(process.cwd(), cropPathRaw);
      const cropUrl = await uploadIfExists(cropPath, '/crops');
      if (cropUrl) {
        doc.analysis = doc.analysis || {};
        doc.analysis.plate = doc.analysis.plate || {};
        doc.analysis.plate.ocrCrop = doc.analysis.plate.ocrCrop || {};
        doc.analysis.plate.ocrCrop.url = cropUrl;
        console.log('  Uploaded crop ->', cropUrl);
      } else {
        console.log('  Crop not found or upload failed:', cropPath);
      }
    }

    await doc.save();
    console.log('  Document updated.');
  }

  console.log('Done. Processed', count, 'documents');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
