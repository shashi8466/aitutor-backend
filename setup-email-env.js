// Quick setup script for email environment variables
// Run this to create a .env file with the required email configuration

import fs from 'fs';
import path from 'path';

console.log('🔧 Setting up Email Environment Variables...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('📄 .env file already exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\nCurrent .env content:');
  console.log(envContent);
  console.log('\n⚠️  Please add these variables if missing:');
} else {
  console.log('📄 Creating new .env file');
}

// Required environment variables
const requiredVars = {
  'BREVO_API_KEY': 'your_brevo_api_key_here',
  'EMAIL_FROM': 'your_verified_sender_email@example.com',
  'EMAIL_USER': 'your_verified_sender_email@example.com',
  'APP_NAME': 'AIPrep365',
  'ADMIN_EMAIL': 'admin@example.com',
  'FRONTEND_URL': 'https://your-domain.com'
};

console.log('\n📝 Required Email Environment Variables:');
console.log('=====================================\n');

Object.entries(requiredVars).forEach(([key, defaultValue]) => {
  console.log(`${key}=${defaultValue}`);
});

console.log('\n🔧 Setup Instructions:');
console.log('1. Get Brevo API Key from https://app.brevo.com/');
console.log('2. Verify sender email in Brevo dashboard');
console.log('3. Replace the placeholder values above');
console.log('4. Add to your .env file or set as system environment variables');

console.log('\n🚀 Quick Setup Commands:');
console.log('```bash');
console.log('# For Windows (Command Prompt)');
console.log('set BREVO_API_KEY=your_brevo_api_key_here');
console.log('set EMAIL_FROM=your_verified_sender_email@example.com');
console.log('set ADMIN_EMAIL=admin@example.com');
console.log('');
console.log('# For Windows (PowerShell)');
console.log('$env:BREVO_API_KEY="your_brevo_api_key_here"');
console.log('$env:EMAIL_FROM="your_verified_sender_email@example.com"');
console.log('$env:ADMIN_EMAIL="admin@example.com"');
console.log('');
console.log('# For Linux/Mac');
console.log('export BREVO_API_KEY="your_brevo_api_key_here"');
console.log('export EMAIL_FROM="your_verified_sender_email@example.com"');
console.log('export ADMIN_EMAIL="admin@example.com"');
console.log('```');

console.log('\n📧 After setting up:');
console.log('1. Restart your server');
console.log('2. Submit the demo form again');
console.log('3. Check server logs for email debugging information');

// Create .env file if it doesn't exist
if (!envExists) {
  const envContent = Object.entries(requiredVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Created .env file with placeholder values');
  console.log('📝 Please edit the .env file and replace placeholder values');
}

console.log('\n✨ Email environment setup guide completed!');
