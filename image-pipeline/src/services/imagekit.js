const ImageKit = require('@imagekit/nodejs');

const client = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

async function uploadBuffer(buffer, fileName, folder) {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) {
    throw new Error('IMAGEKIT_PRIVATE_KEY is not configured');
  }

  const result = await client.files.upload({
    file: await ImageKit.toFile(buffer, fileName),
    fileName,
    folder,
  });

  return result;
}

module.exports = {
  uploadBuffer,
};