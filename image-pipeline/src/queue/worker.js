const { Worker } = require('bullmq');
const path = require('path');

const { connection } = require('./queue');
const Image = require('../models/Image');

const {
  analyzeImage,
  hammingDistance
} = require('../utils/imageUtils');

const {
  detectVehicles
} = require('../services/vehicleDetection');

const {
  detectPlates
} = require('../services/plateDetection');

const {
  cropPlateForOCR
} = require('../services/cropUtils');

const {
  extractPlateText
} = require('../services/paddleOCR');


const worker = new Worker(
  'image-processing',
  async (job) => {

    const {
      processingId,
      filePath
    } = job.data;

    const doc = await Image.findOne({
      processingId
    });

    if (!doc) {
      throw new Error(
        'Image document not found'
      );
    }

    try {

      // ==================================================
      // 1. START PROCESSING
      // ==================================================

      doc.status = 'processing';
      doc.processingStartedAt = new Date();

      await doc.save();

      console.log(
        `[${processingId}] Processing started`
      );


      // ==================================================
      // 2. EXISTING IMAGE ANALYSIS
      // ==================================================

      const analysis =
        await analyzeImage(filePath);


      // ==================================================
      // 3. VEHICLE DETECTION
      // ==================================================

      console.log(
        `[${processingId}] Detecting vehicles...`
      );

      const vehicleResult =
        await detectVehicles(filePath);

      if (
        vehicleResult.success &&
        vehicleResult.primaryVehicle
      ) {

        analysis.vehicle = {
          vehicleCount:
            vehicleResult.vehicleCount,

          primaryVehicle:
            vehicleResult.primaryVehicle
        };

        console.log(
          `[${processingId}] Vehicles found: ` +
          `${vehicleResult.vehicleCount}`
        );

        console.log(
          `[${processingId}] Primary vehicle: ` +
          `${vehicleResult.primaryVehicle.class_name}`
        );

      } else {

        analysis.vehicle = {
          vehicleCount: 0,
          primaryVehicle: null
        };

        console.log(
          `[${processingId}] No vehicle detected`
        );
      }


      // ==================================================
      // 4. PLATE DETECTION
      // ==================================================

      console.log(
        `[${processingId}] Detecting license plates...`
      );

      /*
       * IMPORTANT:
       * Plate detection is done on the ORIGINAL image.
       *
       * plateDetection.js already selects the largest
       * detected plate as primaryPlate.
       */

      const plateResult =
        await detectPlates(filePath);


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
        // 5. CREATE OCR CROP
        // ==================================================

        /*
         * Store generated OCR crops in:
         *
         * image-pipeline/uploads/crops/
         *
         * The crop is taken directly from the ORIGINAL image
         * using the selected plate bbox.
         */

        const cropDir = path.join(
          __dirname,
          '..',
          '..',
          'uploads',
          'crops'
        );

        const ocrCropPath = path.join(
          cropDir,
          `${processingId}-plate-ocr.png`
        );

        const ocrCrop =
          await cropPlateForOCR(
            filePath,
            primaryPlate.bbox,
            ocrCropPath,
            0.25
          );

        console.log(
          `[${processingId}] OCR crop created: ` +
          `${ocrCrop.outputPath}`
        );


        // ==================================================
        // 6. PADDLE OCR
        // ==================================================

        console.log(
          `[${processingId}] Running PaddleOCR...`
        );

        const ocrResult =
          await extractPlateText(
            ocrCrop.outputPath
          );

        if (!ocrResult.success) {
          throw new Error(
            `PaddleOCR failed: ${ocrResult.error}`
          );
        }

        console.log(
          `[${processingId}] Plate number: ` +
          `${ocrResult.text}`
        );


        // ==================================================
        // 7. STORE VEHICLE + PLATE + OCR RESULTS
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
              primaryPlate.class_name || 'number_plate'
          },

          ocrCrop: {
            path:
              ocrCrop.outputPath,

            bbox:
              ocrCrop.expandedBbox,

            dimensions:
              ocrCrop.cropDimensions
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
      // 8. DUPLICATE DETECTION
      // ==================================================

      let duplicate = null;
      let duplicateType = null;
      let hammingDist = null;


      // Exact MD5 match first
      const md5Match =
        await Image.findOne({
          _id: {
            $ne: doc._id
          },

          'analysis.md5':
            analysis.md5,

          status: 'completed'
        });


      if (md5Match) {

        duplicate = md5Match;
        duplicateType = 'md5';
        hammingDist = 0;

      } else if (analysis.pHash) {

        // pHash similarity
        const threshold = 5;

        const completedImages =
          await Image.find({
            _id: {
              $ne: doc._id
            },

            status: 'completed',

            'analysis.pHash': {
              $exists: true
            }
          });


        for (
          const img of completedImages
        ) {

          const distance =
            hammingDistance(
              analysis.pHash,
              img.analysis.pHash
            );

          if (
            distance <= threshold
          ) {

            duplicate = img;
            duplicateType = 'phash';
            hammingDist = distance;

            break;
          }
        }
      }


      // ==================================================
      // 9. BUILD DUPLICATE OBJECT
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

        analysis.duplicate = null;
      }


      // ==================================================
      // 10. SAVE RESULT
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

      console.error(
        `[${processingId}] Worker error:`,
        err
      );

      doc.status =
        'failed';

      doc.error =
        String(
          err.message || err
        );

      await doc.save();

      throw err;
    }
  },
  {
    connection
  }
);


worker.on(
  'failed',
  (job, err) => {

    console.error(
      `Job ${job?.id} failed:`,
      err?.message || err
    );

  }
);


module.exports = worker;