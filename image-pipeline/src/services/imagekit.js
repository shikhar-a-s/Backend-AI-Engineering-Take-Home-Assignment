const ImageKit = require('@imagekit/nodejs');

function getClient() {
  return new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || undefined,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || undefined,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || undefined,
  });
}

async function uploadBuffer(buffer, fileName, folder) {
  if (!process.env.IMAGEKIT_PRIVATE_KEY) {
    throw new Error('IMAGEKIT_PRIVATE_KEY is not configured');
  }

  const client = getClient();
  // Upload as base64 to be safe across environments
  const base64 = buffer.toString('base64');
  const result = await client.upload({
    file: base64,
    fileName,
    folder,
    isBase64: true,
  });

  return result;
}

module.exports = {
  uploadBuffer,
};