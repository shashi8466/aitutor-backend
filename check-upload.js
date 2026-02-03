
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Starting Upload Service Diagnostic...\n');

// 1. Check Dependencies
console.log('📦 Checking dependencies...');
const deps = ['multer', 'adm-zip', 'pdf-parse', 'xmldom', '@supabase/supabase-js'];
for (const dep of deps) {
    try {
        await import(dep);
        console.log(` ✅ ${dep} is installed`);
    } catch (err) {
        console.error(` ❌ ${dep} is MISSING! Error: ${err.message}`);
    }
}

// 2. Check File Paths
console.log('\n📂 Checking source files...');
const files = [
    './src/server/routes/upload.js',
    './src/server/utils/parser.js',
    './src/utils/omml2latex.js'
];
for (const file of files) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
        console.log(` ✅ ${file} exists`);
    } else {
        console.error(` ❌ ${file} is MISSING at ${fullPath}`);
    }
}

// 3. Check Temp Directory
console.log('\n📁 Checking temp directory...');
const tempDir = path.join(process.cwd(), 'temp_uploads');
try {
    if (!fs.existsSync(tempDir)) {
        console.log(' ℹ️ temp_uploads does not exist, attempting to create...');
        fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test');
    fs.unlinkSync(path.join(tempDir, 'test.txt'));
    console.log(' ✅ temp_uploads is writable');
} catch (err) {
    console.error(` ❌ temp_uploads issue: ${err.message}`);
}

// 4. Attempt Import of Upload Route
console.log('\n🧪 Testing import of upload route...');
try {
    const uploadModule = await import('./src/server/routes/upload.js');
    console.log(' ✅ Successfully imported upload.js');
    if (uploadModule.default) {
        console.log(' ✅ export default found');
    } else {
        console.warn(' ⚠️ export default NOT found! (This would cause issues in index.js)');
    }
} catch (err) {
    console.error(' ❌ FAILED to import upload.js:');
    console.error(err);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✨ Diagnostic Complete');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
