const { v4: uuidv4 } = require('uuid');
const path = require('path');
const Image = require('../models/Image');
const { imageQueue } = require('../queue/queue');

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const processingId = uuidv4();
    const doc = await Image.create({
      processingId,
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      status: 'pending'
    });

    // enqueue job
    await imageQueue.add('process-image', { processingId, filePath: req.file.path });

    return res.status(202).json({ processingId, status: 'pending', message: 'Upload accepted. Processing queued.' });
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
