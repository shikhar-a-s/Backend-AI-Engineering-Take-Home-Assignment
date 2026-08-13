const axios = require('axios');
const fs = require('fs');
require('dotenv').config();


async function detectPlates(imagePath) {

  try {

    // ==================================================
    // 1. CHECK API KEY
    // ==================================================

    const apiKey =
      process.env.ROBOFLOW_API_KEY;

    if (!apiKey) {

      throw new Error(
        'ROBOFLOW_API_KEY is not set in .env'
      );
    }


    // ==================================================
    // 2. CHECK IMAGE
    // ==================================================

    if (!fs.existsSync(imagePath)) {

      throw new Error(
        `Image not found: ${imagePath}`
      );
    }


    // ==================================================
    // 3. READ IMAGE
    // ==================================================

    const imageBase64 =
      fs
        .readFileSync(imagePath)
        .toString('base64');


    // ==================================================
    // 4. ROBOFLOW WORKFLOW
    // ==================================================

    const workspaceName =
      'shikhar-a-s';

    const workflowId =
      'general-segmentation-api-4';


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


    // ==================================================
    // 5. SEND IMAGE TO ROBOFLOW
    // ==================================================

    const response =
      await axios.post(

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
            'Content-Type':
              'application/json'
          }
        }
      );


    const data =
      response.data;


    // ==================================================
    // 6. EXTRACT PREDICTIONS
    // ==================================================

    let predictions = [];


    if (
      data &&
      Array.isArray(data.outputs) &&
      data.outputs.length > 0 &&
      data.outputs[0].predictions &&
      Array.isArray(
        data.outputs[0]
          .predictions
          .predictions
      )
    ) {

      predictions =
        data.outputs[0]
          .predictions
          .predictions;
    }


    console.log(
      `Workflow predictions found: ${predictions.length}`
    );


    // ==================================================
    // 7. CONVERT ROBOFLOW PREDICTIONS
    // ==================================================

    let plates =
      predictions

        .filter(
          (pred) =>
            pred.class ===
            'number_plate'
        )

        .map((pred) => {

          // Roboflow:
          //
          // x, y = center
          // width, height = dimensions
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
                pred.confidence
                  .toFixed(4)
              ),

            bbox: [

              Number(
                x1.toFixed(2)
              ),

              Number(
                y1.toFixed(2)
              ),

              Number(
                x2.toFixed(2)
              ),

              Number(
                y2.toFixed(2)
              )
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


    // ==================================================
    // 8. SORT BY AREA
    //
    // Largest plate becomes the major plate.
    // ==================================================

    plates.sort(
      (a, b) =>
        b.area - a.area
    );


    // ==================================================
    // 9. 45% SIGNIFICANCE RULE
    //
    // The largest detected plate establishes
    // the major area.
    //
    // A secondary region is significant only if
    // its area is >= 45% of the major plate area.
    //
    // This prevents tiny regions such as "IND"
    // from being treated as the main registration
    // plate.
    // ==================================================

    const majorArea =
      plates.length > 0
        ? plates[0].area
        : 0;


    const significanceThreshold =
      majorArea * 0.45;


    const significantPlates =
      majorArea > 0

        ? plates.filter(
            (plate) =>
              plate.area >=
              significanceThreshold
          )

        : [];


    // ==================================================
    // 10. SELECT PRIMARY PLATE
    //
    // significantPlates is already sorted by
    // descending area.
    //
    // Therefore the first element is the largest
    // significant plate.
    // ==================================================

    const primaryPlate =
      significantPlates.length > 0
        ? significantPlates[0]
        : null;


    // ==================================================
    // 11. PRINT DETECTIONS
    // ==================================================

    console.log('');

    console.log(
      'Detected plates:'
    );


    plates.forEach(
      (plate, index) => {

        const significant =
          plate.area >=
          significanceThreshold;


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

        console.log(
          `    45% threshold: ${
            significanceThreshold.toFixed(2)
          }px²`
        );

        console.log(
          `    Significant: ${
            significant
              ? 'YES'
              : 'NO'
          }`
        );

        console.log('');
      }
    );


    // ==================================================
    // 12. PRIMARY PLATE INFORMATION
    // ==================================================

    if (primaryPlate) {

      console.log(
        'Primary plate selected by largest significant area:'
      );

      console.log(
        `  Confidence: ${
          primaryPlate.confidence
        }`
      );

      console.log(
        `  Bbox: [${
          primaryPlate.bbox.join(', ')
        }]`
      );

      console.log(
        `  Size: ${
          primaryPlate.width
        }x${
          primaryPlate.height
        }px`
      );

      console.log(
        `  Area: ${
          primaryPlate.area
        }px²`
      );

      console.log(
        `  Major area: ${
          majorArea
        }px²`
      );

      console.log(
        `  45% threshold: ${
          significanceThreshold.toFixed(2)
        }px²`
      );

      console.log('');
    }


    // ==================================================
    // 13. RETURN RESULT
    // ==================================================

    return {

      success: true,

      // Total detections returned by Roboflow.
      // We keep this as the actual detection count.
      plateCount:
        plates.length,

      // All Roboflow detections.
      plates,

      // Detections that passed the 45% rule.
      significantPlates,

      // Largest significant plate.
      primaryPlate,

      // Useful for debugging / API response.
      majorArea,

      significanceThreshold
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