const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  processingId: { type: String, required: true, unique: true, index: true },
  originalFilename: String,
  filePath: String,
  mimeType: String,
  fileSize: Number,
  width: Number,
  height: Number,
  status: { type: String, enum: ['pending','processing','completed','failed'], default: 'pending', index: true },
  error: String,
  analysis: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  processingStartedAt: Date,
  completedAt: Date
});

module.exports = mongoose.model('Image', ImageSchema);
