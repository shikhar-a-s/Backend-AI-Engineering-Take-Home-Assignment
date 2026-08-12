const axios = require('axios');
require('dotenv').config();

async function testWorkflowSchema() {
  const apiKey = process.env.ROBOFLOW_API_KEY;

  if (!apiKey) {
    console.log('❌ ROBOFLOW_API_KEY not found in .env');
    process.exit(1);
  }

  const workspace = 'shikhara-s';
  const workflow = 'general-segmentation-api-4';

  const url =
    `https://serverless.roboflow.com/` +
    `${workspace}/workflows/${workflow}/describe_interface`;

  try {
    console.log('Checking Workflow schema...');
    console.log(`Workspace: ${workspace}`);
    console.log(`Workflow: ${workflow}`);
    console.log('');

    const response = await axios.post(
      url,
      {
        api_key: apiKey
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✓ Workflow schema received');
    console.log('');

    console.log(
      JSON.stringify(response.data, null, 2)
    );

  } catch (err) {
    console.log('❌ Workflow schema request failed');

    console.log(
      err.response?.data || err.message
    );
  }
}

testWorkflowSchema();