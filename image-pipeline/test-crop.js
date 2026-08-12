const { detectVehicles } = require('./src/services/vehicleDetection');
const { cropImage, cropMultiple } = require('./src/services/cropUtils');
const path = require('path');
const fs = require('fs');

async function testCropping() {
  try {
    // Get test image path from command line or use default
    const testImage = process.argv[2] || path.join(__dirname, 'test-vehicle-image.jpg');
    
    if (!fs.existsSync(testImage)) {
      console.log('❌ Image not found:', testImage);
      process.exit(1);
    }

    console.log('Vehicle Crop Test\n');
    console.log('Input image:', testImage);
    console.log('');

    // Step 1: Detect vehicles
    console.log('Step 1: Detecting vehicles...');
    const detection = await detectVehicles(testImage);

    if (!detection.primaryVehicle) {
      console.log('❌ No vehicles detected');
      process.exit(1);
    }

    console.log('✓ Detection complete');
    console.log(`  - Vehicles found: ${detection.vehicleCount}`);
    console.log(`  - Primary: ${detection.primaryVehicle.class_name}`);
    console.log(`  - Confidence: ${detection.primaryVehicle.confidence}`);
    console.log(`  - Bbox: [${detection.primaryVehicle.bbox.join(', ')}]`);
    console.log('');

    // Step 2: Crop primary vehicle
    console.log('Step 2: Cropping primary vehicle...');
    const primaryBbox = detection.primaryVehicle.bbox;
    const cropOutputDir = path.join(__dirname, 'uploads', 'crops');
    const primaryCropPath = path.join(cropOutputDir, 'primary-vehicle.png');

    const cropResult = await cropImage(testImage, primaryBbox, primaryCropPath);
    
    console.log('✓ Crop complete');
    console.log(`  - Output: ${cropResult.outputPath}`);
    console.log(`  - Dimensions: ${cropResult.cropDimensions.width}x${cropResult.cropDimensions.height}`);
    console.log(`  - Aspect ratio: ${cropResult.aspectRatio}`);
    console.log('');

    // Step 3: Crop all vehicles for comparison
    if (detection.vehicleCount > 1) {
      console.log('Step 3: Cropping all vehicles for comparison...');
      const allBboxes = detection.vehicles.map(v => v.bbox);
      const multiCropResult = await cropMultiple(testImage, allBboxes, cropOutputDir);
      
      console.log('✓ All crops complete:');
      multiCropResult.crops.forEach(crop => {
        console.log(`  - Crop ${crop.index}: ${crop.cropDimensions.width}x${crop.cropDimensions.height}px`);
      });
      console.log('');
    }

    // Summary
    console.log('Summary:');
    console.log(`  ✓ Primary vehicle crop saved to:`);
    console.log(`    ${primaryCropPath}`);
    console.log('');
    console.log('  📋 Next steps:');
    console.log('    1. Open the cropped image to inspect quality');
    console.log('    2. Verify it contains the primary vehicle');
    console.log('    3. Check for any background clutter that might affect OCR');
    console.log('    4. If satisfied, proceed to Stage 4: OCR integration');
    console.log('');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testCropping();
