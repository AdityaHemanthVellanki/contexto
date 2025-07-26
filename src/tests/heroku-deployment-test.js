/**
 * Heroku Deployment Test Script
 * This script tests the Heroku deployment functionality with a minimal test case
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// Generate a random ID for this test run
const randomId = uuidv4().substring(0, 8);

async function testHerokuDeployment() {
  console.log('🚀 Testing Heroku Deployment Flow\n');
  
  // 1. Check environment variables
  console.log('1️⃣ Checking environment variables...');
  
  const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
  const HEROKU_TEAM = process.env.HEROKU_TEAM || null;
  const HEROKU_REGION = process.env.HEROKU_REGION || 'us';
  
  if (!HEROKU_API_KEY) {
    console.error('❌ Missing required environment variable: HEROKU_API_KEY');
    return false;
  }
  
  console.log('✅ Required environment variables are set:');
  console.log(`- HEROKU_API_KEY: ${HEROKU_API_KEY.substring(0, 4)}...`);
  if (HEROKU_TEAM) console.log(`- HEROKU_TEAM: ${HEROKU_TEAM}`);
  console.log(`- HEROKU_REGION: ${HEROKU_REGION}`);
  
  // 2. Create test pipeline ID and mock download URL
  const pipelineId = 'test-pipeline-' + randomId;
  const mockDownloadUrl = `https://example.com/${pipelineId}.zip`;
  // Ensure app name is under 30 characters (Heroku limit)
  const shortId = randomId.substring(0, 6);
  const appName = `mcp-${shortId}`;
  
  console.log(`✅ Test pipeline ID created: ${pipelineId}`);
  console.log(`✅ Mock download URL created: ${mockDownloadUrl}`);
  console.log(`✅ App name will be: ${appName}`);
  
  // 3. Test Heroku Platform API
  console.log('\n3️⃣ Testing Heroku Platform API...');
  
  try {
    // Create a new Heroku app
    console.log('Creating Heroku app...');
    
    const createAppOptions = {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      },
      body: JSON.stringify({
        name: appName,
        region: HEROKU_REGION,
        ...(HEROKU_TEAM ? { team: HEROKU_TEAM } : {})
      })
    };
    
    const appResponse = await fetch('https://api.heroku.com/apps', createAppOptions);
    
    if (!appResponse.ok) {
      const errorText = await appResponse.text();
      console.error(`❌ Failed to create Heroku app: ${appResponse.status}`);
      console.error(errorText);
      return false;
    }
    
    const appData = await appResponse.json();
    console.log(`✅ Heroku app created: ${appData.name} (${appData.id})`);
    
    // 4. Set config vars
    console.log('\n4️⃣ Setting config vars...');
    
    const configVars = {
      NODE_ENV: 'production',
      PORT: '3000',
      PIPELINE_ID: pipelineId,
      TEST_VAR: 'test-value'
    };
    
    const configResponse = await fetch(`https://api.heroku.com/apps/${appName}/config-vars`, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      },
      body: JSON.stringify(configVars)
    });
    
    if (!configResponse.ok) {
      const errorText = await configResponse.text();
      console.error(`❌ Failed to set config vars: ${configResponse.status}`);
      console.error(errorText);
      return false;
    }
    
    console.log('✅ Config vars set successfully');
    
    // 5. Create a build (in a real scenario, we'd use the source URL)
    console.log('\n5️⃣ Creating build...');
    
    // For testing, we'll create a minimal build with a simple Procfile
    const buildResponse = await fetch(`https://api.heroku.com/apps/${appName}/builds`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      },
      body: JSON.stringify({
        source_blob: {
          url: mockDownloadUrl,
          version: '1.0'
        }
      })
    });
    
    if (!buildResponse.ok) {
      const errorText = await buildResponse.text();
      console.error(`❌ Failed to create build: ${buildResponse.status}`);
      console.error(errorText);
      return false;
    }
    
    const buildData = await buildResponse.json();
    console.log(`✅ Build created: ${buildData.id}`);
    
    // 6. Clean up (delete the app)
    console.log('\n6️⃣ Cleaning up test app...');
    
    const deleteResponse = await fetch(`https://api.heroku.com/apps/${appName}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/vnd.heroku+json; version=3',
        'Authorization': `Bearer ${HEROKU_API_KEY}`
      }
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error(`❌ Failed to delete app: ${deleteResponse.status}`);
      console.error(errorText);
    } else {
      console.log(`✅ App ${appName} deleted successfully`);
    }
    
    console.log('\n✅ Heroku deployment test completed successfully!');
    return true;
  } catch (error) {
    console.error('\n❌ Heroku deployment test failed:', error);
    console.error("\nTroubleshooting:");
    console.error("1. Your HEROKU_API_KEY may be invalid or expired");
    console.error("2. You may have reached your app limit on Heroku");
    console.error("3. The app name may already be taken");
    console.error("4. Check network connectivity to api.heroku.com");
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testHerokuDeployment().then(success => {
    if (!success) {
      console.error('\n❌ Heroku deployment test failed');
      process.exit(1);
    } else {
      console.log('\n✅ Heroku deployment test passed');
    }
  }).catch(error => {
    console.error('\n❌ Unhandled error in test:', error);
    process.exit(1);
  });
}

module.exports = {
  testHerokuDeployment
};
