const { spawn } = require('child_process');
const path = require('path');

async function extractPlateText(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(
      __dirname,
      'paddle-ocr.py'
    );

    const pythonExecutable =
      process.env.PADDLE_PYTHON ||
      (process.platform === 'win32'
        ? path.join(
            __dirname,
            '..',
            '..',
            '..',
            'paddle-env',
            'Scripts',
            'python.exe'
          )
        : 'python3');

    const python = spawn(
      pythonExecutable,
      [pythonScript, imagePath],
      {
        stdio: ['pipe', 'pipe', 'pipe']
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
          `Failed to start PaddleOCR: ${err.message}`
        )
      );
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `PaddleOCR failed with code ${code}\n${errorOutput}\n${output}`
          )
        );
        return;
      }

      try {
        // ------------------------------------------------
        // PaddleOCR may print logs before the JSON.
        // Find the LAST JSON object in stdout.
        // ------------------------------------------------

        const lines = output
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(Boolean);

        let jsonText = null;

        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];

          if (
            line.startsWith('{') &&
            line.endsWith('}')
          ) {
            jsonText = line;
            break;
          }
        }

        if (!jsonText) {
          throw new Error(
            `No JSON result found in PaddleOCR output.\n\nSTDOUT:\n${output}\n\nSTDERR:\n${errorOutput}`
          );
        }

        const result = JSON.parse(jsonText);

        if (!result.success) {
          reject(
            new Error(
              result.error ||
              'PaddleOCR returned failure'
            )
          );
          return;
        }

        resolve(result);

      } catch (err) {
        reject(
          new Error(
            `Failed to parse PaddleOCR output: ${err.message}\n\nOutput:\n${output}`
          )
        );
      }
    });
  });
}

module.exports = {
  extractPlateText
};