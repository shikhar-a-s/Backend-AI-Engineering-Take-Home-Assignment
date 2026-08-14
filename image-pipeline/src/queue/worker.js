const { Worker } = require('bullmq');
const path = require('path');

const { connection } = require('./queue');
const Image = require('../models/Image');

const {
  analyzeImage,
  hammingDistance
} = require('../utils/imageUtils');

const {
  detectPlates
} = require('../services/plateDetection');

const {
  cropPlateForOCR
} = require('../services/cropUtils');

const {
  extractPlateText
} = require('../services/rapidOCR');


const worker = new Worker(
  'image-processing',

  async (job) => {

   const {
     processingId,
     filePath,
     imageUrl
   } = job.data;

   const doc = await Image.findOne({ processingId });

   if (!doc) {
     throw new Error('Image document not found');
   }

   // If imageUrl is provided (ImageKit), download to a temp file for processing
   let downloadedPath = null;
   try {
     if (imageUrl && !filePath) {
       const { downloadImage } = require('../services/downloadImage');
       downloadedPath = await downloadImage(imageUrl, processingId, path.extname(imageUrl) || '.png');
     }

     const sourcePath = filePath || downloadedPath;

     if (!sourcePath) {
       throw new Error('No source image available for processing');
     }

     // ==================================================
     // 1. START PROCESSING
     // ==================================================

     doc.status = 'processing';
     doc.processingStartedAt = new Date();
     await doc.save();

     console.log(`[${processingId}] Processing started`);

     // ==================================================
     // 2. EXISTING IMAGE ANALYSIS
     // ==================================================

     const analysis = await analyzeImage(sourcePath);

     // ==================================================
     // 3. PLATE DETECTION
     // ==================================================

      console.log(
        `[${processingId}] Detecting license plates...`
      );

      /*
       * Plate detection is performed directly
       * on the original image using Roboflow.
       *
       * plateDetection.js:
       *
       * 1. Gets all number_plate detections
       * 2. Calculates area
       * 3. Sorts descending by area
       * 4. Selects plates[0] as primaryPlate
       */

      const plateResult = await detectPlates(sourcePath);


      if (
        plateResult.success &&
        plateResult.primaryPlate
      ) {

        const primaryPlate =
          plateResult.primaryPlate;

        console.log(
          `[${processingId}] Plates found: ` +
          `${plateResult.plateCount}`
        );

        console.log(
          `[${processingId}] Selected plate area: ` +
          `${primaryPlate.area}`
        );

        console.log(
          `[${processingId}] Selected plate bbox: ` +
          `[${primaryPlate.bbox.join(', ')}]`
        );


        // ==================================================
        // 4. CREATE OCR CROP
        // ==================================================

        const cropDir = path.join(process.cwd(), 'tmp', 'crops');
        const fs = require('fs');
        if (!fs.existsSync(cropDir)) fs.mkdirSync(cropDir, { recursive: true });

        const ocrCropPath = path.join(cropDir, `${processingId}-plate-ocr.png`);

        /*
         * Crop directly from the original image.
         *
         * Keep the existing crop utility and its
         * current expansion/upscaling behavior.
         */

        const ocrCrop = await cropPlateForOCR(sourcePath, primaryPlate.bbox, ocrCropPath, 0.25);

        console.log(`[${processingId}] OCR crop created: ${ocrCrop.outputPath}`);

        // (Upload of OCR crop deferred until after OCR completes so RapidOCR can read the local file)


        // NOTE: OCR crop upload is performed after OCR completes using the unified @imagekit/nodejs service below.
        // The earlier upload-at-creation step was removed to avoid requiring the deprecated 'imagekit' SDK.

        console.log(`[${processingId}] Running RapidOCR...`);

        const ocrResult =
          await extractPlateText(
            ocrCrop.outputPath
          );

        if (!ocrResult.success) {

          throw new Error(
  `RapidOCR failed: ${ocrResult.error}`
);
        }
        console.log(
          `[${processingId}] Plate number: ` +
          `${ocrResult.text}`
        );

                // Upload OCR crop to ImageKit and store durable URL (after OCR)
                try {
                  const fsPromises = require('fs').promises;
                  const { uploadBuffer } = require('../services/imagekit');
                  const cropBuffer = await fsPromises.readFile(ocrCrop.outputPath);
                  const cropFileName = `${processingId}-plate-ocr.png`;
                  const cropUpload = await uploadBuffer(cropBuffer, cropFileName, '/image-pipeline/crops');
                  console.log(`[${processingId}] Uploaded OCR crop to ImageKit: ${cropUpload.url}`);

                  ocrCrop.uploadUrl = cropUpload.url;

                  try { await fsPromises.unlink(ocrCrop.outputPath); } catch (e) { /* ignore */ }
                } catch (e) {
                  console.error(`[${processingId}] Failed to upload OCR crop to ImageKit:`, e);
                }


                // ==================================================
                // 6. STORE PLATE + OCR RESULTS
                // ==================================================

        analysis.plate = {

          plateCount:
            plateResult.plateCount,

          primaryPlate: {

            confidence:
              primaryPlate.confidence,

            bbox:
              primaryPlate.bbox,

            width:
              primaryPlate.width,

            height:
              primaryPlate.height,

            area:
              primaryPlate.area,

            class_name:
              primaryPlate.class_name ||
              'number_plate'
          },

          ocrCrop: {
ocrCrop: {
  path: ocrCrop.outputPath,

  url:
    ocrCrop.uploadUrl ||
    ocrCrop.url ||
    null,

  bbox:
    ocrCrop.expandedBbox,

  dimensions:
    ocrCrop.cropDimensions
}
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

      } else {

        analysis.plate = {

          plateCount: 0,

          primaryPlate: null,

          ocrCrop: null,

          ocr: null
        };

        console.log(
          `[${processingId}] No license plate detected`
        );
      }


      // ==================================================
      // 7. DUPLICATE DETECTION
      // ==================================================

      let duplicate =
        null;

      let duplicateType =
        null;

      let hammingDist =
        null;


      // --------------------------------------------------
      // Exact MD5 match
      // --------------------------------------------------

      const md5Match =
        await Image.findOne({

          _id: {
            $ne: doc._id
          },

          'analysis.md5':
            analysis.md5,

          status:
            'completed'
        });


      if (md5Match) {

        duplicate =
          md5Match;

        duplicateType =
          'md5';

        hammingDist =
          0;

      } else if (
        analysis.pHash
      ) {

        // ------------------------------------------------
        // pHash similarity
        // ------------------------------------------------

        const threshold =
          5;

        const completedImages =
          await Image.find({

            _id: {
              $ne: doc._id
            },

            status:
              'completed',

            'analysis.pHash': {
              $exists: true
            }
          });


        for (
          const img
          of completedImages
        ) {

          const distance =
            hammingDistance(
              analysis.pHash,
              img.analysis.pHash
            );

          if (
            distance <=
            threshold
          ) {

            duplicate =
              img;

            duplicateType =
              'phash';

            hammingDist =
              distance;

            break;
          }
        }
      }


      // ==================================================
      // 8. BUILD DUPLICATE OBJECT
      // ==================================================

      if (duplicate) {

        analysis.duplicate = {

          type:
            duplicateType,

          matchProcessingId:
            duplicate.processingId,

          distance:
            hammingDist
        };

      } else {

        analysis.duplicate =
          null;
      }


      // ==================================================
      // 9. SAVE RESULT
      // ==================================================

      doc.analysis =
        analysis;

      doc.width =
        analysis.width ||
        doc.width;

      doc.height =
        analysis.height ||
        doc.height;

      doc.status =
        'completed';

      doc.completedAt =
        new Date();

      await doc.save();

      console.log(
        `[${processingId}] Processing completed`
      );

    } catch (err) {

      console.error(`[${processingId}] Worker error:`, err);

      doc.status = 'failed';
      doc.error = String(err.message || err);
      await doc.save();

      throw err;

    } finally {
      // cleanup downloaded temp file if present
      try {
        const fsPromises = require('fs').promises;
        if (downloadedPath) {
          await fsPromises.unlink(downloadedPath);
        }
      } catch (cleanupErr) {
        // ignore cleanup errors
      }
    }
  },

  {
    connection
  }
);


// ======================================================
// BULLMQ FAILURE HANDLER
// ======================================================

worker.on(
  'failed',

  (job, err) => {

    console.error(
      `Job ${job?.id} failed:`,
      err?.message || err
    );

  }
);


module.exports =
  worker;