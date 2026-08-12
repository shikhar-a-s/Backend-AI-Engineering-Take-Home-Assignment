const { detectVehicles } = require('./src/services/vehicleDetection');
const fs = require('fs');
const path = require('path');

async function testVehicleDetection() {
  console.log('Vehicle Detection Test\n');
  console.log('Prerequisites:');
  console.log('  1. Python 3.8+');
  console.log('  2. pip install ultralytics opencv-python');
  console.log('');

  // Check if test image exists
  const testImagePath = path.join(__dirname, 'test-vehicle-image.jpg');
  
  if (!fs.existsSync(testImagePath)) {
    console.log('❌ Test image not found: test-vehicle-image.jpg');
    console.log('   Please provide a test image with vehicles');
    console.log('   Usage: Place a multi-vehicle image at: ' + testImagePath);
    process.exit(1);
  }

  try {
    console.log(`Testing detection on: ${testImagePath}\n`);
    const result = await detectVehicles(testImagePath);
    
    console.log('✓ Detection successful!\n');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.vehicleCount > 0) {
      console.log('\n✓ PASS: Vehicles detected');
      console.log(`  - Total vehicles: ${result.vehicleCount}`);
      console.log(`  - Primary vehicle: ${result.primaryVehicle.class_name}`);
      console.log(`  - Confidence: ${result.primaryVehicle.confidence}`);
      console.log(`  - Bbox: [${result.primaryVehicle.bbox.join(', ')}]`);
      console.log(`  - Area: ${result.primaryVehicle.area}`);
    } else {
      console.log('\n⚠ WARNING: No vehicles detected');
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
    process.exit(1);
  }
}

testVehicleDetection();
