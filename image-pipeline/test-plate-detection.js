const {
  detectPlates
} = require('./src/services/plateDetection');

const {
  cropImage,
  cropPlateForOCR
} = require('./src/services/cropUtils');

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');


async function testPlateDetection() {
  try {

    // ==================================================
    // IMAGE PATH
    // ==================================================

    const imagePath =
      process.argv[2] ||
      path.join(
        __dirname,
        'uploads',
        'crops',
        'primary-vehicle.png'
      );

    // ==================================================
    // CHECK IMAGE
    // ==================================================

    if (!fs.existsSync(imagePath)) {

      console.log(
        '❌ Image not found:',
        imagePath
      );

      process.exit(1);
    }

    // ==================================================
    // IMAGE DIMENSIONS
    // ==================================================

    const metadata =
      await sharp(imagePath).metadata();

    console.log(
      'License Plate Detection Test\n'
    );

    console.log(
      'Prerequisites:'
    );

    console.log(
      '  1. Roboflow API key configured in .env'
    );

    console.log(
      '  2. Indian license plate detection model'
    );

    console.log(
      '  3. Internet connection'
    );

    console.log('');

    console.log(
      `Input: ${imagePath}`
    );

    console.log('');

    console.log(
      'Local image dimensions:'
    );

    console.log(
      `  Width: ${metadata.width}`
    );

    console.log(
      `  Height: ${metadata.height}`
    );

    console.log('');

    // ==================================================
    // STEP 1: DETECT PLATES
    // ==================================================

    console.log(
      'Step 1: Detecting license plates...'
    );

    const result =
      await detectPlates(imagePath);

    if (!result.success) {

      console.log(
        '❌ Plate detection failed'
      );

      console.log(
        'Error:',
        result.error
      );

      process.exit(1);
    }

    console.log(
      '✓ Plate detection complete'
    );

    console.log(
      `  - Plates detected: ${result.plateCount}`
    );

    // ==================================================
    // NO PLATES
    // ==================================================

    if (result.plateCount === 0) {

      console.log(
        '\n⚠ WARNING: No license plates detected'
      );

      console.log(
        '\nPossible reasons:'
      );

      console.log(
        '  1. Plate is not visible'
      );

      console.log(
        '  2. Model did not detect the plate'
      );

      console.log(
        '  3. Plate is at an extreme angle'
      );

      console.log(
        '  4. Image quality is too low'
      );

      console.log(
        '  5. Confidence threshold is too high'
      );

      process.exit(1);
    }

    // ==================================================
    // PRIMARY PLATE
    //
    // plateDetection.js already selects the
    // largest plate by area.
    // ==================================================

    const primaryPlate =
      result.primaryPlate;

    console.log('');

    console.log(
      'Primary plate:'
    );

    console.log(
      `  - Confidence: ${primaryPlate.confidence}`
    );

    console.log(
      `  - Bbox: [${primaryPlate.bbox.join(', ')}]`
    );

    console.log(
      `  - Size: ${primaryPlate.width}x${primaryPlate.height}px`
    );

    console.log(
      `  - Area: ${primaryPlate.area}px²`
    );

    console.log('');

    // ==================================================
    // OUTPUT DIRECTORY
    // ==================================================

    const plateOutputDir =
      path.join(
        __dirname,
        'uploads',
        'crops'
      );

    if (!fs.existsSync(plateOutputDir)) {

      fs.mkdirSync(
        plateOutputDir,
        {
          recursive: true
        }
      );
    }

    // ==================================================
    // STEP 2: CROP ALL DETECTED PLATES
    // ==================================================

    console.log(
      'Step 2: Cropping all detected plates...'
    );

    const cropResults = [];

    for (
      let i = 0;
      i < result.plates.length;
      i++
    ) {

      const plate =
        result.plates[i];

      // ----------------------------------------------
      // Normal plate crop
      // ----------------------------------------------

      const filename =
        `plate-${i}-conf${(
          plate.confidence * 100
        ).toFixed(0)}.png`;

      const plateCropPath =
        path.join(
          plateOutputDir,
          filename
        );

      const cropResult =
        await cropImage(
          imagePath,
          plate.bbox,
          plateCropPath
        );

      cropResults.push({
        index: i,
        confidence:
          plate.confidence,
        path:
          cropResult.outputPath,
        dimensions:
          cropResult.cropDimensions
      });

      console.log(
        `  ✓ Plate ${i}: ${filename}`
      );

      console.log(
        `    - Confidence: ${plate.confidence}`
      );

      console.log(
        `    - Bbox: [${plate.bbox.join(', ')}]`
      );

      console.log(
        `    - Size: ${
          cropResult.cropDimensions.width
        }x${
          cropResult.cropDimensions.height
        }px`
      );

      // ----------------------------------------------
      // OCR crop
      //
      // IMPORTANT:
      // This is cropped from the ORIGINAL image
      // with 25% padding.
      // ----------------------------------------------

      const ocrFilename =
        `plate-${i}-ocr.png`;

      const ocrPath =
        path.join(
          plateOutputDir,
          ocrFilename
        );

      const ocrCrop =
        await cropPlateForOCR(
          imagePath,
          plate.bbox,
          ocrPath,
          0.25
        );

      console.log(
        `    ✓ OCR crop: ${ocrFilename}`
      );

      console.log(
        `      Size: ${
          ocrCrop.cropDimensions.width
        }x${
          ocrCrop.cropDimensions.height
        }px`
      );

      console.log(
        `      Expanded bbox: [` +
        `${ocrCrop.expandedBbox.join(', ')}` +
        `]`
      );

      console.log('');
    }

    // ==================================================
    // SUMMARY
    // ==================================================

    console.log(
      'Summary:'
    );

    console.log(
      `  ✓ ${result.plates.length} license plate(s) detected`
    );

    console.log(
      '  ✓ Normal plate crops created'
    );

    console.log(
      '  ✓ OCR crops created from original image'
    );

    console.log('');

    console.log(
      'Plate crops saved to:'
    );

    cropResults.forEach(
      (r) => {

        console.log(
          `  [${r.index}] ${r.path}`
        );

        console.log(
          `      Confidence: ${(
            r.confidence * 100
          ).toFixed(2)}%`
        );

        console.log(
          `      Size: ${
            r.dimensions.width
          }x${
            r.dimensions.height
          }px`
        );

      }
    );

    console.log('');

    console.log(
      'Primary plate selected:'
    );

    console.log(
      `  ${path.join(
        plateOutputDir,
        `plate-0-conf${(
          primaryPlate.confidence * 100
        ).toFixed(0)}.png`
      )}`
    );

    console.log('');

    console.log(
      'OCR crop to test:'
    );

    console.log(
      `  ${path.join(
        plateOutputDir,
        'plate-0-ocr.png'
      )}`
    );

    console.log('');

    console.log(
      '✓ Plate detection and cropping complete.'
    );

    console.log('');

    console.log(
      'Next: test OCR on plate-0-ocr.png'
    );

  } catch (err) {

    console.error(
      '❌ Error:',
      err.message
    );

    process.exit(1);
  }
}


testPlateDetection();