import fs from 'fs';
import path from 'path';

const secrets = [
    'xkeysib-[a-zA-Z0-9-]{60,}', // Brevo API Keys
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+', // JWT (Supabase keys)
    're_[a-zA-Z0-9]{20,}', // Resend API Keys
    'AC[a-zA-Z0-9]{32}', // Twilio SID
];

const sensitiveFields = [
    'BREVO_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'EMAIL_PASS',
    'GMAIL_APP_PASS',
    'RESEND_API_KEY',
    'TWILIO_AUTH_TOKEN'
];

function sanitizeContent(content) {
    let sanitized = content;
    
    // Replace patterns
    for (const secret of secrets) {
        const regex = new RegExp(secret, 'g');
        sanitized = sanitized.replace(regex, '[REDACTED]');
    }

    // Replace assignments in MD files like: KEY=VALUE
    for (const field of sensitiveFields) {
        const regex = new RegExp(`${field}=([^\\s\\n\\r"'\\s]+)`, 'g');
        sanitized = sanitized.replace(regex, `${field}=[REDACTED]`);
    }

    return sanitized;
}

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
            processDirectory(fullPath);
        } else if (file.endsWith('.md') || file.endsWith('.sql') || file.endsWith('.js') || file.endsWith('.html')) {
            if (file === 'cleanup_secrets.js') continue;
            
            const content = fs.readFileSync(fullPath, 'utf8');
            const sanitized = sanitizeContent(content);
            if (content !== sanitized) {
                console.log(`🧹 Sanitizing: ${fullPath}`);
                fs.writeFileSync(fullPath, sanitized, 'utf8');
            }
        }
    }
}

console.log('🚀 Starting secret cleanup...');
processDirectory(process.cwd());
console.log('✨ Cleanup complete!');
