const { detectVehicles } = require('./src/services/vehicleDetection');

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
    const imagePath = process.argv[2];

    if (!imagePath) {
      console.log(
        'Usage: node test-full-pipeline.js "path/to/image.png"'
      );
      process.exit(1);
    }

    if (!fs.existsSync(imagePath)) {
      console.log('❌ Image not found:', imagePath);
      process.exit(1);
    }

    console.log('======================================');
    console.log('FULL IMAGE PIPELINE TEST');
    console.log('======================================');
    console.log('');
    console.log('Input:', imagePath);
    console.log('');

    // ==================================================
    // STEP 1: VEHICLE DETECTION
    // ==================================================

    console.log('Step 1: Detecting vehicles...');

    const vehicleResult =
      await detectVehicles(imagePath);

    if (
      !vehicleResult.success ||
      !vehicleResult.primaryVehicle
    ) {
      throw new Error(
        'No primary vehicle detected'
      );
    }

    const primaryVehicle =
      vehicleResult.primaryVehicle;

    console.log('✓ Vehicle detection complete');

    console.log(
      `  Vehicles found: ${vehicleResult.vehicleCount}`
    );

    console.log(
      `  Primary vehicle: ${primaryVehicle.class_name}`
    );

    console.log(
      `  Confidence: ${primaryVehicle.confidence}`
    );

    console.log(
      `  Bbox: [${primaryVehicle.bbox.join(', ')}]`
    );

    console.log('');

    // ==================================================
    // STEP 2: PLATE DETECTION
    // ==================================================

    console.log(
      'Step 2: Detecting license plates...'
    );

    // Plate detection is performed on the ORIGINAL image.
    const plateResult =
      await detectPlates(imagePath);

    if (
      !plateResult.success ||
      !plateResult.primaryPlate
    ) {
      throw new Error(
        'No license plate detected'
      );
    }

    const primaryPlate =
      plateResult.primaryPlate;

    console.log(
      '✓ Plate detection complete'
    );

    console.log(
      `  Plates found: ${plateResult.plateCount}`
    );

    console.log(
      `  Selected plate confidence: ${primaryPlate.confidence}`
    );

    console.log(
      `  Selected plate area: ${primaryPlate.area}px²`
    );

    console.log(
      `  Plate bbox: [${primaryPlate.bbox.join(', ')}]`
    );

    console.log('');

    // ==================================================
    // STEP 3: CREATE OCR CROP
    // ==================================================

    console.log(
      'Step 3: Creating OCR crop...'
    );

    const cropDir =
      path.join(
        __dirname,
        'uploads',
        'crops'
      );

    if (!fs.existsSync(cropDir)) {
      fs.mkdirSync(
        cropDir,
        { recursive: true }
      );
    }

    const ocrCropPath =
      path.join(
        cropDir,
        'pipeline-plate-ocr.png'
      );

    const ocrCrop =
      await cropPlateForOCR(
        imagePath,
        primaryPlate.bbox,
        ocrCropPath,
        0.25
      );

    console.log(
      '✓ OCR crop created'
    );

    console.log(
      `  Output: ${ocrCrop.outputPath}`
    );

    console.log(
      `  Size: ${
        ocrCrop.cropDimensions.width
      }x${
        ocrCrop.cropDimensions.height
      }px`
    );

    console.log(
      `  Expanded bbox: [` +
      `${ocrCrop.expandedBbox.join(', ')}` +
      `]`
    );

    console.log('');

    // ==================================================
    // STEP 4: PADDLE OCR
    // ==================================================

    console.log(
      'Step 4: Running PaddleOCR...'
    );

    const ocrResult =
      await extractPlateText(
        ocrCrop.outputPath
      );

    if (!ocrResult.success) {
      throw new Error(
        ocrResult.error ||
        'PaddleOCR failed'
      );
    }

    console.log(
      '✓ PaddleOCR complete'
    );

    console.log(
      `  Plate number: ${ocrResult.text}`
    );

    console.log(
      `  Raw text: ${ocrResult.rawText}`
    );

    console.log('');

    console.log('OCR lines:');

    ocrResult.lines.forEach(
      (line, index) => {
        console.log(
          `  ${index + 1}. ${line.text} ` +
          `(confidence: ${line.confidence})`
        );
      }
    );

    console.log('');

    // ==================================================
    // FINAL RESULT
    // ==================================================

    const finalResult = {
      success: true,

      image: imagePath,

      vehicle: {
        class_name:
          primaryVehicle.class_name,

        confidence:
          primaryVehicle.confidence,

        bbox:
          primaryVehicle.bbox
      },

      plate: {
        confidence:
          primaryPlate.confidence,

        bbox:
          primaryPlate.bbox,

        area:
          primaryPlate.area
      },

      ocr: {
        plateNumber:
          ocrResult.text,

        rawText:
          ocrResult.rawText,

        lines:
          ocrResult.lines
      }
    };

    console.log(
      '======================================'
    );

    console.log(
      'FINAL RESULT'
    );

    console.log(
      '======================================'
    );

    console.log(
      JSON.stringify(
        finalResult,
        null,
        2
      )
    );

    console.log('');
    console.log(
      '🔥 FULL PIPELINE SUCCESS'
    );

  } catch (err) {
    console.error('');
    console.error(
      '❌ PIPELINE FAILED'
    );
    console.error(
      err.message
    );

    process.exit(1);
  }
}

runPipeline();