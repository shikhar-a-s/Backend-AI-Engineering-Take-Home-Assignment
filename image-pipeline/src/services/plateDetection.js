const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

async function detectPlates(imagePath) {
  try {
    // --------------------------------------------------
    // 1. Check API key
    // --------------------------------------------------

    const apiKey = process.env.ROBOFLOW_API_KEY;

    if (!apiKey) {
      throw new Error(
        'ROBOFLOW_API_KEY is not set in .env'
      );
    }

    // --------------------------------------------------
    // 2. Check image
    // --------------------------------------------------

    if (!fs.existsSync(imagePath)) {
      throw new Error(
        `Image not found: ${imagePath}`
      );
    }

    // --------------------------------------------------
    // 3. Read image and convert to Base64
    // --------------------------------------------------

    const imageBase64 = fs
      .readFileSync(imagePath)
      .toString('base64');

    // --------------------------------------------------
    // 4. Roboflow Workflow
    // --------------------------------------------------

    const workspaceName = 'shikhar-a-s';
    const workflowId = 'general-segmentation-api-4';

    const url =
      `https://serverless.roboflow.com/infer/workflows/` +
      `${workspaceName}/${workflowId}`;

    console.log(
      'Calling Roboflow Workflow...'
    );

    console.log(
      `Workspace: ${workspaceName}`
    );

    console.log(
      `Workflow: ${workflowId}`
    );

    console.log('');

    // --------------------------------------------------
    // 5. Send image to Roboflow
    // --------------------------------------------------

    const response = await axios.post(
      url,
      {
        api_key: apiKey,

        inputs: {
          image: {
            type: 'base64',
            value: imageBase64
          },

          classes: 'number_plate'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = response.data;

    // --------------------------------------------------
    // 6. Extract predictions
    //
    // Roboflow workflow responses can expose
    // predictions in different structures.
    //
    // We support:
    //
    // outputs[0].predictions[]
    //
    // and:
    //
    // outputs[0].predictions.predictions[]
    // --------------------------------------------------

    let predictions = [];

    if (
      data &&
      Array.isArray(data.outputs)
    ) {
      for (const output of data.outputs) {

        if (
          Array.isArray(
            output?.predictions
          )
        ) {
          predictions.push(
            ...output.predictions
          );
        }

        if (
          Array.isArray(
            output?.predictions?.predictions
          )
        ) {
          predictions.push(
            ...output.predictions.predictions
          );
        }
      }
    }

    console.log(
      `Workflow predictions found: ${predictions.length}`
    );

    // --------------------------------------------------
    // 7. Convert Roboflow predictions
    // --------------------------------------------------

    const plates = predictions
      .filter(
        (pred) =>
          pred &&
          pred.class === 'number_plate'
      )
      .map((pred) => {

        // Roboflow:
        //
        // x, y      = center
        // width     = bbox width
        // height    = bbox height
        //
        // Convert to:
        //
        // x1, y1, x2, y2

        const x1 =
          pred.x -
          pred.width / 2;

        const y1 =
          pred.y -
          pred.height / 2;

        const x2 =
          pred.x +
          pred.width / 2;

        const y2 =
          pred.y +
          pred.height / 2;

        const area =
          pred.width *
          pred.height;

        return {
          confidence:
            Number(
              Number(
                pred.confidence
              ).toFixed(4)
            ),

          bbox: [
            Number(x1.toFixed(2)),
            Number(y1.toFixed(2)),
            Number(x2.toFixed(2)),
            Number(y2.toFixed(2))
          ],

          area:
            Number(
              area.toFixed(2)
            ),

          width:
            Number(
              pred.width.toFixed(2)
            ),

          height:
            Number(
              pred.height.toFixed(2)
            ),

          class_name:
            pred.class,

          detection_id:
            pred.detection_id ||
            null
        };
      });

    // --------------------------------------------------
    // 8. Sort by AREA
    //
    // Largest plate first.
    // Therefore plates[0] is the largest plate.
    // --------------------------------------------------

    plates.sort(
      (a, b) =>
        b.area - a.area
    );

    // --------------------------------------------------
    // 9. Print detections
    // --------------------------------------------------

    console.log('');
    console.log(
      'Detected plates:'
    );

    plates.forEach(
      (plate, index) => {

        console.log(
          `  Plate ${index}:`
        );

        console.log(
          `    Confidence: ${plate.confidence}`
        );

        console.log(
          `    Bbox: [${plate.bbox.join(', ')}]`
        );

        console.log(
          `    Size: ${plate.width}x${plate.height}px`
        );

        console.log(
          `    Area: ${plate.area}px²`
        );

        console.log('');
      }
    );

    // --------------------------------------------------
    // 10. Select primary plate
    // --------------------------------------------------

    const primaryPlate =
      plates.length > 0
        ? plates[0]
        : null;

    if (primaryPlate) {

      console.log(
        'Primary plate selected by largest area:'
      );

      console.log(
        `  Confidence: ${primaryPlate.confidence}`
      );

      console.log(
        `  Bbox: [${primaryPlate.bbox.join(', ')}]`
      );

      console.log(
        `  Size: ${primaryPlate.width}x${primaryPlate.height}px`
      );

      console.log(
        `  Area: ${primaryPlate.area}px²`
      );

      console.log('');
    }

    // --------------------------------------------------
    // 11. Return result
    // --------------------------------------------------

    return {
      success: true,

      plateCount:
        plates.length,

      plates,

      primaryPlate
    };

  } catch (err) {

    console.error(
      'Roboflow Workflow error:',
      err.response?.data ||
      err.message
    );

    return {
      success: false,

      error:
        err.response?.data ||
        err.message
    };
  }
}

module.exports = {
  detectPlates
};