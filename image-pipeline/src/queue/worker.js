const { Worker } = require('bullmq');
const { connection } = require('./queue');
const Image = require('../models/Image');
const { analyzeImage, hammingDistance } = require('../utils/imageUtils');

const worker = new Worker('image-processing', async job => {
  const { processingId, filePath } = job.data;
  const doc = await Image.findOne({ processingId });
  if (!doc) throw new Error('Image document not found');

  try {
    doc.status = 'processing';
    doc.processingStartedAt = new Date();
    await doc.save();

    const analysis = await analyzeImage(filePath);

    // Query MongoDB for duplicates: exact MD5 match first
    let duplicate = null;
    let duplicateType = null;
    let hammingDist = null;

    const md5Match = await Image.findOne({
      _id: { $ne: doc._id },
      'analysis.md5': analysis.md5,
      status: 'completed'
    });

    if (md5Match) {
      duplicate = md5Match;
      duplicateType = 'md5';
      hammingDist = 0;
    } else if (analysis.pHash) {
      // If no exact MD5 match, check pHash similarity using Hamming distance
      const threshold = 5; // max 5 bits difference out of 64
      const completedImages = await Image.find({
        _id: { $ne: doc._id },
        status: 'completed',
        'analysis.pHash': { $exists: true }
      });

      for (const img of completedImages) {
        const distance = hammingDistance(analysis.pHash, img.analysis.pHash);
        if (distance <= threshold) {
          duplicate = img;
          duplicateType = 'phash';
          hammingDist = distance;
          break;
        }
      }
    }

    // Build duplicate object matching API spec
    if (duplicate) {
      analysis.duplicate = {
        type: duplicateType,
        matchProcessingId: duplicate.processingId,
        distance: hammingDist
      };
    } else {
      analysis.duplicate = null;
    }

    doc.analysis = analysis;
    doc.width = analysis.width || doc.width;
    doc.height = analysis.height || doc.height;
    doc.status = 'completed';
    doc.completedAt = new Date();
    await doc.save();
  } catch (err) {
    console.error('Worker error', err);
    doc.status = 'failed';
    doc.error = String(err.message || err);
    await doc.save();
    throw err;
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err?.message || err);
});

module.exports = worker;
