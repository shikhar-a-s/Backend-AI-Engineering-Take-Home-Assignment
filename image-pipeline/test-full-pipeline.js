const {
  detectPlates
} = require('./src/services/plateDetection');

const {
  cropPlateForOCR
} = require('./src/services/cropUtils');

const {
  extractPlateText
} = require('./src/services/paddleOCR');

const path = require('path');
const fs = require('fs');


async function runPipeline() {

  try {

    const imagePath =
      process.argv[2];

    if (!imagePath) {

      console.log(
        'Usage: node test-full-pipeline.js "path/to/image.png"'
      );

      process.exit(1);
    }


    if (!fs.existsSync(imagePath)) {

      console.log(
        `Image not found: ${imagePath}`
      );

      process.exit(1);
    }


    console.log(
      '======================================'
    );

    console.log(
      'FULL IMAGE PIPELINE TEST'
    );

    console.log(
      '======================================'
    );

    console.log('');

    console.log(
      `Input: ${imagePath}`
    );

    console.log('');


    // ==================================================
    // 1. ROBoflow PLATE DETECTION
    // ==================================================

    console.log(
      'Step 1: Detecting license plates...'
    );

    const plateResult =
      await detectPlates(
        imagePath
      );


    if (
      !plateResult.success
    ) {

      throw new Error(
        `Roboflow plate detection failed: ${
          plateResult.error
        }`
      );
    }


    if (
      !plateResult.primaryPlate
    ) {

      throw new Error(
        'No license plate detected'
      );
    }


    const primaryPlate =
      plateResult.primaryPlate;


    console.log('');

    console.log(
      `✓ Plates detected: ${
        plateResult.plateCount
      }`
    );

    console.log(
      `✓ Primary plate selected by area`
    );

    console.log(
      `  Confidence: ${
        primaryPlate.confidence
      }`
    );

    console.log(
      `  Bbox: [${
        primaryPlate.bbox.join(', ')
      }]`
    );

    console.log(
      `  Area: ${
        primaryPlate.area
      }px²`
    );

    console.log('');


    // ==================================================
    // 2. OCR CROP
    // ==================================================

    console.log(
      'Step 2: Creating OCR crop...'
    );


    const cropDir =
      path.join(
        __dirname,
        'uploads',
        'crops'
      );


    if (
      !fs.existsSync(cropDir)
    ) {

      fs.mkdirSync(
        cropDir,
        {
          recursive: true
        }
      );
    }


    const ocrCropPath =
      path.join(
        cropDir,
        'full-pipeline-plate-ocr.png'
      );


    const ocrCrop =
      await cropPlateForOCR(
        imagePath,
        primaryPlate.bbox,
        ocrCropPath,
        0.25
      );


    console.log(
      `✓ OCR crop created`
    );

    console.log(
      `  Path: ${
        ocrCrop.outputPath
      }`
    );

    console.log(
      `  Dimensions: ${
        ocrCrop.cropDimensions.width
      }x${
        ocrCrop.cropDimensions.height
      }`
    );

    console.log(
      `  Expanded bbox: [${
        ocrCrop.expandedBbox.join(', ')
      }]`
    );

    console.log('');


    // ==================================================
    // 3. PADDLE OCR
    // ==================================================

    console.log(
      'Step 3: Running PaddleOCR...'
    );


    const ocrResult =
      await extractPlateText(
        ocrCrop.outputPath
      );


    if (
      !ocrResult.success
    ) {

      throw new Error(
        `PaddleOCR failed: ${
          ocrResult.error
        }`
      );
    }


    console.log('');

    console.log(
      '✓ OCR complete'
    );

    console.log(
      `  Plate text: ${
        ocrResult.text
      }`
    );

    console.log(
      `  Raw text: ${
        ocrResult.rawText
      }`
    );


    if (
      Array.isArray(
        ocrResult.lines
      )
    ) {

      console.log('');

      console.log(
        '  Lines:'
      );

      ocrResult.lines.forEach(
        (line, index) => {

          console.log(
            `    ${
              index + 1
            }. ${
              line.text
            } (confidence: ${
              line.confidence
            })`
          );

        }
      );
    }


    // ==================================================
    // 4. FINAL RESULT
    // ==================================================

    console.log('');

    console.log(
      '======================================'
    );

    console.log(
      'PIPELINE SUCCESS'
    );

    console.log(
      '======================================'
    );

    console.log('');

    console.log(
      `Plate count: ${
        plateResult.plateCount
      }`
    );

    console.log(
      `Selected plate area: ${
        primaryPlate.area
      }px²`
    );

    console.log(
      `Plate number: ${
        ocrResult.text
      }`
    );

    console.log('');

    console.log(
      'Pipeline:'
    );

    console.log(
      '  Image'
    );

    console.log(
      '    ↓'
    );

    console.log(
      '  Roboflow plate detection'
    );

    console.log(
      '    ↓'
    );

    console.log(
      '  Largest plate (plates[0])'
    );

    console.log(
      '    ↓'
    );

    console.log(
      '  OCR crop'
    );

    console.log(
      '    ↓'
    );

    console.log(
      '  PaddleOCR'
    );

    console.log(
      '    ↓'
    );

    console.log(
      `  ${ocrResult.text}`
    );

    console.log('');

  } catch (err) {

    console.error('');

    console.error(
      '❌ PIPELINE FAILED'
    );

    console.error('');

    console.error(
      err.message || err
    );

    process.exit(1);
  }
}


runPipeline();