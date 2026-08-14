const { spawn } = require('child_process');
const path = require('path');

const os = require('os');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

async function runRapidOCR(pythonExecutable, pythonScript, imgPath) {
  return new Promise((resolve, reject) => {
    const python = spawn(
      pythonExecutable,
      [pythonScript, imgPath],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => { output += data.toString(); });
    python.stderr.on('data', (data) => { errorOutput += data.toString(); });

    python.on('error', (err) => {
      reject(new Error(`Failed to start RapidOCR: ${err.message}`));
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`RapidOCR failed with code ${code}\n${errorOutput}\n${output}`));
        return;
      }

      try {
        const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let jsonText = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if (line.startsWith('{') && line.endsWith('}')) { jsonText = line; break; }
        }
        if (!jsonText) {
          throw new Error(`No JSON result found in RapidOCR output.\nSTDOUT:\n${output}\nSTDERR:\n${errorOutput}`);
        }
        const result = JSON.parse(jsonText);
        if (!result.success) {
          reject(new Error(result.error || 'RapidOCR returned failure'));
          return;
        }
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse RapidOCR output: ${err.message}\nOutput:\n${output}`));
      }
    });
  });
}

async function extractPlateText(imagePath) {
  // Prepare python invocation
  const pythonScript = path.join(__dirname, 'rapid-ocr.py');
  const pythonExecutable = process.env.RAPIDOCR_PYTHON || (
    process.platform === 'win32'
      ? path.join(__dirname, '..', '..', 'deploy-env', 'Scripts', 'python.exe')
      : 'python3'
  );

  // First attempt: run RapidOCR on the provided imagePath
  try {
    const first = await runRapidOCR(pythonExecutable, pythonScript, imagePath);
    // If first attempt produced useful text/lines, return it.
    if (first && first.success && (first.text || (first.lines && first.lines.length > 0))) {
      return first;
    }
  } catch (err) {
    // If python failed to run, surface the error immediately
    // so callers can handle missing RapidOCR environment.
    throw err;
  }

  // Second attempt: create an enhanced upscaled image using sharp and retry
  let tempPath = null;
  try {
    // Read metadata to compute upscale dimensions
    const meta = await sharp(imagePath).metadata();
    const width = meta.width || 0;
    const scale = 4; // upscale multiplier (tuned for small crops)
    const outWidth = Math.max( Math.round(width * scale), width * 2 );
    tempPath = path.join(os.tmpdir(), `${uuidv4()}-ocr.png`);

    await sharp(imagePath)
      .resize({ width: outWidth })
      .grayscale()
      .normalise()
      .sharpen()
      .toFile(tempPath);

    const second = await runRapidOCR(pythonExecutable, pythonScript, tempPath);
    if (second && second.success && (second.text || (second.lines && second.lines.length > 0))) {
      return second;
    }

    // If still no result, return the second result (even if empty) to let caller decide
    return second;
  } finally {
    // Cleanup temp file if it was created
    try { if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
  }
}

module.exports = {
  extractPlateText
};