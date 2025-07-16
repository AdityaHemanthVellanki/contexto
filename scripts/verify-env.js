require('dotenv').config();

// Print available environment variables (hiding secrets)
const envVars = Object.keys(process.env).sort();
console.log('Available environment variables:');
envVars.forEach(key => {
  // Mask sensitive values
  if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('PASSWORD')) {
    console.log(`${key}: [HIDDEN]`);
  } else {
    // Show the first few characters of other values
    const value = process.env[key];
    if (value && value.length > 20) {
      console.log(`${key}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`${key}: ${value || '(empty)'}`);
    }
  }
});

// Check required Firebase variables
const requiredVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'
];

console.log('\nChecking required variables:');
let allPresent = true;

requiredVars.forEach(key => {
  const value = process.env[key];
  if (!value) {
    console.log(`❌ ${key} is missing`);
    allPresent = false;
  } else {
    console.log(`✅ ${key} is present`);
  }
});

if (!allPresent) {
  console.log('\n⚠️ Some required environment variables are missing!');
  console.log('Make sure your .env or .env.local file is properly set up.');
  console.log('Check that the variable names match exactly as expected.');
} else {
  console.log('\n✅ All required environment variables are present.');
}

// Special check for private key formatting
if (process.env.FIREBASE_PRIVATE_KEY) {
  if (!process.env.FIREBASE_PRIVATE_KEY.includes('-----BEGIN PRIVATE KEY-----')) {
    console.log('\n⚠️ Warning: FIREBASE_PRIVATE_KEY does not appear to be properly formatted.');
    console.log('It should include the "-----BEGIN PRIVATE KEY-----" prefix.');
  }
  
  if (!process.env.FIREBASE_PRIVATE_KEY.includes('\\n') && !process.env.FIREBASE_PRIVATE_KEY.includes('\n')) {
    console.log('\n⚠️ Warning: FIREBASE_PRIVATE_KEY does not contain newlines.');
    console.log('Make sure it includes "\\n" for line breaks.');
  }
}
