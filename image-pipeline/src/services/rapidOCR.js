const { spawn } = require('child_process');
const path = require('path');

async function extractPlateText(imagePath) {
  return new Promise((resolve, reject) => {

    const pythonScript = path.join(
      __dirname,
      'rapid-ocr.py'
    );

    const pythonExecutable =
      process.env.RAPIDOCR_PYTHON ||
      (
        process.platform === 'win32'
          ? path.join(
              __dirname,
              '..',
              '..',
              'deploy-env',
              'Scripts',
              'python.exe'
            )
          : 'python3'
      );

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

    python.stdout.on(
      'data',
      (data) => {
        output += data.toString();
      }
    );

    python.stderr.on(
      'data',
      (data) => {
        errorOutput += data.toString();
      }
    );

    python.on(
      'error',
      (err) => {
        reject(
          new Error(
            `Failed to start RapidOCR: ${err.message}`
          )
        );
      }
    );

    python.on(
      'close',
      (code) => {

        if (code !== 0) {

          reject(
            new Error(
              `RapidOCR failed with code ${code}\n` +
              `${errorOutput}\n` +
              `${output}`
            )
          );

          return;
        }

        try {

          const lines =
            output
              .split(/\r?\n/)
              .map(
                line => line.trim()
              )
              .filter(Boolean);

          let jsonText = null;

          // Find the final JSON object.
          for (
            let i = lines.length - 1;
            i >= 0;
            i--
          ) {

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
              'No JSON result found in RapidOCR output.\n\n' +
              `STDOUT:\n${output}\n\n` +
              `STDERR:\n${errorOutput}`
            );
          }

          const result =
            JSON.parse(jsonText);

          if (!result.success) {

            reject(
              new Error(
                result.error ||
                'RapidOCR returned failure'
              )
            );

            return;
          }

          resolve(result);

        } catch (err) {

          reject(
            new Error(
              `Failed to parse RapidOCR output: ` +
              `${err.message}\n\n` +
              `Output:\n${output}`
            )
          );
        }
      }
    );
  });
}

module.exports = {
  extractPlateText
};  