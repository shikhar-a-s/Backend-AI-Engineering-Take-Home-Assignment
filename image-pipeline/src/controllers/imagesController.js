const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const Image = require('../models/Image');
const { imageQueue } = require('../queue/queue');
const { uploadBuffer } = require('../services/imagekit');

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const processingId = uuidv4();

    // Upload original to ImageKit
    const fileName = `${processingId}${path.extname(req.file.originalname) || '.png'}`;
    const folder = '/image-pipeline/originals';
    const uploadResult = await uploadBuffer(req.file.buffer, fileName, folder);

    const doc = await Image.create({
      processingId,
      originalFilename: req.file.originalname,
      filePath: null,
      imageUrl: uploadResult.url,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: 'pending'
    });

<<<<<<< ours
    // Upload to ImageKit for durable storage (if configured)
    try {
      const { uploadFromPath } = require('../services/imagekitClient');
      if (process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
        const ikRes = await uploadFromPath(req.file.path, '/uploads');
        if (ikRes && ikRes.url) {
          doc.fileUrl = ikRes.url;
          await doc.save();
        }
      }
    } catch (ikErr) {
      console.warn('ImageKit upload failed:', ikErr && ikErr.message ? ikErr.message : ikErr);
    }

    // enqueue job (keep using local filePath for worker processing)
    await imageQueue.add('process-image', { processingId, filePath: req.file.path });
=======
    // enqueue job with durable image URL
    await imageQueue.add('process-image', { processingId, imageUrl: uploadResult.url });
>>>>>>> theirs

    return res.status(202).json({ processingId, status: 'pending', message: 'Upload accepted. Processing queued.', imageUrl: uploadResult.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const { processingId } = req.params;
    const doc = await Image.findOne({ processingId }).select('processingId status createdAt processingStartedAt completedAt error');
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getResults = async (req, res) => {
  try {
    const { processingId } = req.params;
    const doc = await Image.findOne({ processingId }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
