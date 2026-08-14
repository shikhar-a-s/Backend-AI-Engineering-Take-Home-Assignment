// Backwards-compatible adapter for older callers that expect uploadFromPath
// Re-uses the unified @imagekit/nodejs-based service implemented in ./imagekit

const fs = require('fs');
const path = require('path');
const { uploadBuffer } = require('./imagekit');

async function uploadFromPath(filePath, folder = '/') {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const res = await uploadBuffer(buffer, fileName, folder);
  return res;
}

module.exports = { uploadFromPath };
