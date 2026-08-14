const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function downloadImage(url, processingId, extension = '.png') {
  const tempDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `${processingId}${extension}`);

  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  fs.writeFileSync(filePath, resp.data);
  return filePath;
}

module.exports = { downloadImage };
