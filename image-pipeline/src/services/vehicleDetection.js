const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

async function detectVehicles(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(
      __dirname,
      'yolo-detect.py'
    );

    // Use explicit Python executable.
    // This prevents Windows from using the Microsoft Store alias.
    const pythonExecutable =
      process.env.YOLO_PYTHON ||
      'python';

    const python = spawn(
      pythonExecutable,
      [
        pythonScript,
        imagePath
      ],
      {
        stdio: [
          'pipe',
          'pipe',
          'pipe'
        ]
      }
    );

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('error', (err) => {
      reject(
        new Error(
          `Failed to spawn Python process: ${err.message}`
        )
      );
    });

    python.on('close', (code) => {
      if (code !== 0 && !output.trim()) {
        reject(
          new Error(
            `YOLO process failed with code ${code}\n${errorOutput}`
          )
        );
        return;
      }

      try {
        const result = JSON.parse(
          output.trim()
        );

        if (result.success === false) {
          reject(
            new Error(
              `YOLO detection failed: ${result.error}`
            )
          );
          return;
        }

        resolve(result);

      } catch (err) {
        reject(
          new Error(
            `Failed to parse YOLO output: ${err.message}\n${errorOutput}\n${output}`
          )
        );
      }
    });
  });
}

module.exports = {
  detectVehicles
};