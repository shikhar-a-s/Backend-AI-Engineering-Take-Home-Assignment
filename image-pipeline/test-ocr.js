const {
  extractText
} = require('./src/services/ocr');


async function testOCR() {

  try {

    const imagePath =
      process.argv[2];


    if (!imagePath) {

      console.log(
        'Usage:'
      );

      console.log(
        'node test-ocr.js "path/to/plate.png"'
      );

      process.exit(1);
    }


    console.log(
      'OCR Test'
    );

    console.log('');

    console.log(
      `Input: ${imagePath}`
    );

    console.log('');


    const result =
      await extractText(
        imagePath
      );


    if (!result.success) {

      console.log(
        '❌ OCR failed'
      );

      console.log(
        'Error:',
        result.error
      );

      process.exit(1);
    }


    console.log('');

    console.log(
      '================================'
    );

    console.log(
      'ALL OCR RESULTS'
    );

    console.log(
      '================================'
    );


    if (
      result.results.length === 0
    ) {

      console.log(
        'No characters detected.'
      );

      return;
    }


    result.results.forEach(
      (item, index) => {

        console.log(
          `${index + 1}. ` +
          `Variant=${item.variant}, ` +
          `PSM=${item.psm}, ` +
          `Text="${item.text}"`
        );

      }
    );


    console.log('');

    console.log(
      '================================'
    );

    console.log(
      `BEST RESULT: ${result.text}`
    );

    console.log(
      '================================'
    );

  } catch (err) {

    console.error(
      '❌ Error:',
      err.message
    );

    process.exit(1);
  }
}


testOCR();