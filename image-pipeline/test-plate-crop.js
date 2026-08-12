const { detectPlates } = require('./src/services/plateDetection');
const { cropMultiple } = require('./src/services/cropUtils');
const path = require('path');
const fs = require('fs');

async function testPlateCropping() {
  try {
    const testImage = process.argv[2];

    if (!testImage || !fs.existsSync(testImage)) {
      console.log('❌ Image not found:', testImage);
      process.exit(1);
    }

    console.log('Plate Crop Test\n');
    console.log('Input image:', testImage);
    console.log('');

    // Step 1: Detect plates
    console.log('Step 1: Detecting plates...');

    const detection = await detectPlates(testImage);

    if (!detection.plates || detection.plates.length === 0) {
      console.log('❌ No plates detected');
      process.exit(1);
    }

    console.log('✓ Detection complete');
    console.log(`  - Plates found: ${detection.plateCount}`);

    detection.plates.forEach((plate, index) => {
      console.log(
        `  - Plate ${index}: confidence=${plate.confidence}, bbox=[${plate.bbox.join(', ')}]`
      );
    });

    console.log('');

    // Step 2: Crop all detected plates
    console.log('Step 2: Cropping detected plates...');

    const cropOutputDir = path.join(__dirname, 'uploads', 'crops');

    const bboxes = detection.plates.map(plate => plate.bbox);

    const result = await cropMultiple(
      testImage,
      bboxes,
      cropOutputDir
    );

    console.log('✓ Plate crops complete');

    result.crops.forEach(crop => {
      console.log(
        `  - Plate ${crop.index}: ${crop.cropDimensions.width}x${crop.cropDimensions.height}px`
      );
      console.log(`    ${crop.outputPath}`);
    });

    console.log('');
    console.log('Open the generated plate crops and inspect them.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testPlateCropping();
module.exports = { detectPlates };