const anon = '[REDACTED]';
const service = '[REDACTED]';

function decode(token) {
    try {
        const base64 = token.split('.')[1];
        const json = Buffer.from(base64, 'base64').toString();
        return JSON.parse(json);
    } catch (e) {
        return { error: e.message };
    }
}

console.log('Anon:', decode(anon));
console.log('Service:', decode(service));
