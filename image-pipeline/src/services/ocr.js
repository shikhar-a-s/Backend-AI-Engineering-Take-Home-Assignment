const { execFile } = require('child_process');
const util = require('util');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const execFileAsync =
  util.promisify(execFile);


// ==================================================
// TESSERACT PATH
// ==================================================

const TESSERACT_PATH =
  process.env.TESSERACT_PATH ||
  'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';


// ==================================================
// RUN TESSERACT
// ==================================================

async function runTesseract(
  imagePath,
  psm
) {

  const {
    stdout,
    stderr
  } = await execFileAsync(
    TESSERACT_PATH,
    [
      imagePath,
      'stdout',
      '--psm',
      String(psm),
      '-l',
      'eng',
      '-c',
      'tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    ]
  );

  return {
    text: stdout.trim(),
    stderr
  };
}


// ==================================================
// CLEAN OCR TEXT
// ==================================================

function cleanText(text) {

  return text
    .toUpperCase()
    .replace(
      /[^A-Z0-9]/g,
      ''
    );
}


// ==================================================
// MAIN OCR
// ==================================================

async function extractText(
  imagePath
) {

  try {

    // ----------------------------------------------
    // Check image
    // ----------------------------------------------

    if (!fs.existsSync(imagePath)) {

      throw new Error(
        `Image not found: ${imagePath}`
      );

    }

    // ----------------------------------------------
    // Check Tesseract
    // ----------------------------------------------

    if (!fs.existsSync(TESSERACT_PATH)) {

      throw new Error(
        `Tesseract not found at: ${TESSERACT_PATH}`
      );

    }

    // ----------------------------------------------
    // File names
    // ----------------------------------------------

    const baseName =
      path.basename(
        imagePath,
        path.extname(imagePath)
      );

    const outputDir =
      path.dirname(imagePath);

    // ----------------------------------------------
    // OCR variants
    // ----------------------------------------------

    const variants = [

      {
        name: 'normal',

        pipeline:
          sharp(imagePath)
            .resize({
              width: 1000,
              withoutEnlargement: false,
              kernel:
                sharp.kernel.lanczos3
            })
            .grayscale()
            .normalize()
            .sharpen()
            .png()
      },

      {
        name: 'contrast',

        pipeline:
          sharp(imagePath)
            .resize({
              width: 1000,
              withoutEnlargement: false,
              kernel:
                sharp.kernel.lanczos3
            })
            .grayscale()
            .linear(1.5, -40)
            .sharpen()
            .png()
      },

      {
        name: 'threshold',

        pipeline:
          sharp(imagePath)
            .resize({
              width: 1000,
              withoutEnlargement: false,
              kernel:
                sharp.kernel.lanczos3
            })
            .grayscale()
            .normalize()
            .threshold(140)
            .png()
      },

      {
        name: 'threshold-high',

        pipeline:
          sharp(imagePath)
            .resize({
              width: 1000,
              withoutEnlargement: false,
              kernel:
                sharp.kernel.lanczos3
            })
            .grayscale()
            .normalize()
            .threshold(180)
            .png()
      },

      {
        name: 'rotated-90',

        pipeline:
          sharp(imagePath)
            .resize({
              width: 1000,
              withoutEnlargement: false,
              kernel:
                sharp.kernel.lanczos3
            })
            .rotate(90)
            .grayscale()
            .normalize()
            .sharpen()
            .png()
      },

      {
        name: 'rotated-270',

        pipeline:
          sharp(imagePath)
            .resize({
              width: 1000,
              withoutEnlargement: false,
              kernel:
                sharp.kernel.lanczos3
            })
            .rotate(270)
            .grayscale()
            .normalize()
            .sharpen()
            .png()
      }

    ];


    // ----------------------------------------------
    // OCR results
    // ----------------------------------------------

    const results = [];


    // ----------------------------------------------
    // Test every variant
    // ----------------------------------------------

    for (
      const variant of variants
    ) {

      const processedPath =
        path.join(
          outputDir,
          `${baseName}-ocr-${variant.name}.png`
        );

      // Create processed image
      await variant.pipeline
        .toFile(
          processedPath
        );

      console.log('');
      console.log(
        `Running OCR: ${variant.name}`
      );


      // --------------------------------------------
      // Tesseract modes
      // --------------------------------------------

      const psms = [
        6,
        7,
        11
      ];


      for (
        const psm of psms
      ) {

        try {

          const ocrResult =
            await runTesseract(
              processedPath,
              psm
            );

          const rawText =
            ocrResult.text.trim();

          const cleaned =
            cleanText(
              rawText
            );

          console.log(
            `PSM ${psm}: "${rawText}"`
          );


          if (
            cleaned.length > 0
          ) {

            results.push({

              variant:
                variant.name,

              psm,

              rawText,

              text:
                cleaned

            });

          }

        } catch (err) {

          console.log(
            `PSM ${psm} failed: ${err.message}`
          );

        }

      }

    }


    // ----------------------------------------------
    // No result
    // ----------------------------------------------

    if (
      results.length === 0
    ) {

      console.log('');
      console.log(
        '❌ Tesseract could not recognize any characters.'
      );

      return {

        success: true,

        text: '',

        rawText: '',

        variant: null,

        psm: null,

        results

      };

    }


    // ----------------------------------------------
    // Pick best result
    // ----------------------------------------------

    results.sort(
      (a, b) =>
        b.text.length -
        a.text.length
    );

    const best =
      results[0];


    // ----------------------------------------------
    // Display
    // ----------------------------------------------

    console.log('');

    console.log(
      '================================'
    );

    console.log(
      'BEST OCR RESULT'
    );

    console.log(
      '================================'
    );

    console.log(
      `Variant: ${best.variant}`
    );

    console.log(
      `PSM: ${best.psm}`
    );

    console.log(
      `Raw text: ${best.rawText}`
    );

    console.log(
      `Clean text: ${best.text}`
    );

    console.log(
      '================================'
    );


    // ----------------------------------------------
    // Return
    // ----------------------------------------------

    return {

      success: true,

      text:
        best.text,

      rawText:
        best.rawText,

      variant:
        best.variant,

      psm:
        best.psm,

      results

    };


  } catch (err) {

    console.error(
      'OCR error:',
      err.message
    );

    return {

      success: false,

      text: '',

      rawText: '',

      error:
        err.message

    };

  }
}


// ==================================================
// EXPORT
// ==================================================

module.exports = {
  extractText
};