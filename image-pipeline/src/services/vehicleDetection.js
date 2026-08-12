const { spawn } = require('child_process');
const path = require('path');

/**
 * Detect vehicles in an image using YOLOv8
 * Returns: {
 *   vehicleCount: number,
 *   primaryVehicle: { class_name, confidence, bbox, area },
 *   vehicles: [{ class_name, confidence, bbox, area }, ...]
 * }
 */
async function detectVehicles(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'yolo-detect.py');
    
    const python = spawn('python', [pythonScript, imagePath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      try {
        const result = JSON.parse(output);
        
        if (result.success === false) {
          reject(new Error(`YOLO detection failed: ${result.error}`));
        } else {
          resolve(result);
        }
      } catch (err) {
        reject(new Error(`Failed to parse YOLO output: ${err.message}\n${errorOutput}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

module.exports = { detectVehicles };
