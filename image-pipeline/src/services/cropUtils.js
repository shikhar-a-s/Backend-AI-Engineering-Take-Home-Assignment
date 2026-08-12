const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Crop an image region based on bounding box coordinates.
 *
 * bbox format:
 * [x1, y1, x2, y2]
 */
async function cropImage(imagePath, bbox, outputPath) {
  try {
    const metadata = await sharp(imagePath).metadata();

    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    let [x1, y1, x2, y2] = bbox.map(Math.round);

    // Keep coordinates inside image
    x1 = Math.max(0, x1);
    y1 = Math.max(0, y1);
    x2 = Math.min(imageWidth, x2);
    y2 = Math.min(imageHeight, y2);

    const width = x2 - x1;
    const height = y2 - y1;

    if (width <= 0 || height <= 0) {
      throw new Error(
        `Invalid bbox dimensions: width=${width}, height=${height}`
      );
    }

    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await sharp(imagePath)
      .extract({
        left: x1,
        top: y1,
        width,
        height
      })
      .toFile(outputPath);

    const resultMetadata =
      await sharp(outputPath).metadata();

    return {
      success: true,
      outputPath,
      bbox: [x1, y1, x2, y2],
      cropDimensions: {
        width: resultMetadata.width,
        height: resultMetadata.height
      },
      aspectRatio: (
        resultMetadata.width /
        resultMetadata.height
      ).toFixed(2)
    };

  } catch (err) {
    throw new Error(
      `Failed to crop image: ${err.message}`
    );
  }
}


/**
 * Crop a plate with additional padding.
 *
 * This is used specifically for OCR.
 *
 * The crop is taken directly from the ORIGINAL image.
 */
async function cropPlateForOCR(
  imagePath,
  bbox,
  outputPath,
  paddingPercent = 0.25
) {
  try {
    const metadata = await sharp(imagePath).metadata();

    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    let [x1, y1, x2, y2] =
      bbox.map(Number);

    const plateWidth = x2 - x1;
    const plateHeight = y2 - y1;

    if (
      plateWidth <= 0 ||
      plateHeight <= 0
    ) {
      throw new Error(
        'Invalid plate bounding box'
      );
    }

    // Calculate padding
    const paddingX =
      plateWidth * paddingPercent;

    const paddingY =
      plateHeight * paddingPercent;

    // Expand bbox
    x1 = Math.floor(
      x1 - paddingX
    );

    y1 = Math.floor(
      y1 - paddingY
    );

    x2 = Math.ceil(
      x2 + paddingX
    );

    y2 = Math.ceil(
      y2 + paddingY
    );

    // Keep bbox inside image
    x1 = Math.max(0, x1);
    y1 = Math.max(0, y1);

    x2 = Math.min(
      imageWidth,
      x2
    );

    y2 = Math.min(
      imageHeight,
      y2
    );

    const width = x2 - x1;
    const height = y2 - y1;

    if (width <= 0 || height <= 0) {
      throw new Error(
        'Expanded OCR crop has invalid dimensions'
      );
    }

    // Ensure directory exists
    const outputDir =
      path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(
        outputDir,
        { recursive: true }
      );
    }

    // IMPORTANT:
    // Crop directly from original image
    await sharp(imagePath)
      .extract({
        left: x1,
        top: y1,
        width,
        height
      })
      .toFile(outputPath);

    const cropMetadata =
      await sharp(outputPath).metadata();

    return {
      success: true,

      outputPath,

      originalBbox: bbox,

      expandedBbox: [
        x1,
        y1,
        x2,
        y2
      ],

      paddingPercent,

      cropDimensions: {
        width:
          cropMetadata.width,

        height:
          cropMetadata.height
      },

      aspectRatio: (
        cropMetadata.width /
        cropMetadata.height
      ).toFixed(2)
    };

  } catch (err) {
    throw new Error(
      `Failed to create OCR crop: ${err.message}`
    );
  }
}


/**
 * Crop multiple regions from an image.
 */
async function cropMultiple(
  imagePath,
  bboxes,
  outputDir
) {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(
        outputDir,
        { recursive: true }
      );
    }

    const results = [];

    for (
      let i = 0;
      i < bboxes.length;
      i++
    ) {
      const filename =
        `crop-${i}.png`;

      const outputPath =
        path.join(
          outputDir,
          filename
        );

      const result =
        await cropImage(
          imagePath,
          bboxes[i],
          outputPath
        );

      results.push({
        index: i,
        ...result
      });
    }

    return {
      success: true,
      totalCrops:
        results.length,
      crops: results
    };

  } catch (err) {
    throw new Error(
      `Failed to crop multiple regions: ${err.message}`
    );
  }
}


module.exports = {
  cropImage,
  cropPlateForOCR,
  cropMultiple
};