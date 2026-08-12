const sharp = require('sharp');
const fs = require('fs');
const crypto = require('crypto');

async function computeMD5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const rs = fs.createReadStream(filePath);
    rs.on('data', chunk => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
    rs.on('error', reject);
  });
}

async function computePHash(filePath) {
  // simple average-hash (aHash) implementation for initial pHash-like behaviour
  const buf = await sharp(filePath).resize(8,8).grayscale().raw().toBuffer();
  const vals = Array.from(buf);
  const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
  let bits = vals.map(v => v > avg ? '1' : '0').join('');
  // convert to hex and pad to 16 chars (64 bits = 16 hex digits)
  const hex = parseInt(bits, 2).toString(16).padStart(16, '0');
  return hex;
}

function hammingDistance(hash1, hash2) {
  // Convert hex pHashes to binary and count differing bits
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 64; // max distance for 64-bit
  
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const bit1 = parseInt(hash1[i], 16).toString(2).padStart(4, '0');
    const bit2 = parseInt(hash2[i], 16).toString(2).padStart(4, '0');
    
    for (let j = 0; j < 4; j++) {
      if (bit1[j] !== bit2[j]) distance++;
    }
  }
  return distance;
}

async function blurScore(filePath) {
  // approximate Laplacian variance using a 3x3 kernel on grayscale pixels
  const { data, info } = await sharp(filePath).grayscale().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const get = (x,y) => {
    if (x<0||x>=w||y<0||y>=h) return 0;
    return data[y*w + x];
  };
  const lap = [];
  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      const v = (get(x-1,y) + get(x+1,y) + get(x,y-1) + get(x,y+1) - 4*get(x,y));
      lap.push(v);
    }
  }
  const mean = lap.reduce((s,v)=>s+v,0)/lap.length;
  const variance = lap.reduce((s,v)=>s+(v-mean)*(v-mean),0)/lap.length;
  return variance; // higher = sharper
}

async function brightnessMean(filePath) {
  const { data, info } = await sharp(filePath).grayscale().raw().toBuffer({ resolveWithObject: true });
  const vals = Array.from(data);
  const mean = vals.reduce((s,v)=>s+v,0)/vals.length;
  return mean; // 0-255
}

async function analyzeImage(filePath) {
  const md5 = await computeMD5(filePath);
  const pHash = await computePHash(filePath);
  const blur = await blurScore(filePath);
  const brightness = await brightnessMean(filePath);
  const meta = await sharp(filePath).metadata();

  const result = {
    md5,
    pHash,
    blur: { score: blur, threshold: 100, flagged: blur < 100 },
    brightness: { mean: brightness, flagged: brightness < 40 },
    width: meta.width,
    height: meta.height,
    mime: meta.format,
  };
  return result;
}

module.exports = { computeMD5, computePHash, blurScore, brightnessMean, analyzeImage, hammingDistance };

