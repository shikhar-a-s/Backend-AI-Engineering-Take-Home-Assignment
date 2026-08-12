const {
  extractPlateText
} = require('./src/services/paddleOCR');

async function test() {
  try {
    const imagePath = process.argv[2];

    if (!imagePath) {
      console.log(
        'Usage: node test-paddle-ocr.js "path/to/image.png"'
      );
      process.exit(1);
    }

    console.log('PaddleOCR Node Test');
    console.log('');
    console.log('Input:', imagePath);
    console.log('');

    const result =
      await extractPlateText(imagePath);

    console.log('✓ OCR complete');
    console.log('');
    console.log('Plate text:', result.text);
    console.log('Raw text:', result.rawText);

    console.log('');
    console.log('Lines:');

    for (let i = 0; i < result.lines.length; i++) {
      const line = result.lines[i];

      console.log(
        `  ${i + 1}. ${line.text} ` +
        `(confidence: ${line.confidence})`
      );
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

test();