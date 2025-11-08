
const fs = require('fs');
const path = require('path');

// This script generates a configuration file from environment variables
// which is then fetched by the Angular app before it bootstraps.
const config = {
  API_KEY: process.env.API_KEY || 'YOUR_GEMINI_API_KEY_PLACEHOLDER',
  AURA_USERNAME: process.env.AURA_USERNAME || 'aura',
  AURA_PASSWORD: process.env.AURA_PASSWORD || 'password',
  MONGO_URI: process.env.MONGO_URI || '',
  AURA_BACKEND_URL: process.env.AURA_BACKEND_URL || ''
};

// We specify the output path within the 'src' directory
const configOutputPath = path.resolve(__dirname, 'src/runtime-config.json');

// Write the config object to the file as a JSON string
fs.writeFileSync(configOutputPath, JSON.stringify(config, null, 2), 'utf-8');

console.log(`✅ Configuration file generated successfully at ${configOutputPath}`);
