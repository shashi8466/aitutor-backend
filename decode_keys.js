const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzE4MTIsImV4cCI6MjA4MDg0NzgxMn0.X2jOfdw4umwJ8Bxl_vG_EjAVboyblrV89HWDEnX15R4';
const service = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYXZ1YWNnYmF3aGdjZHh4em9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTI3MTgxMiwiZXhwIjoyMDgwODQ3ODEyfQ.tlXF8-WLZP79LGhsmHC_-fsdUCd1TxhQaBTzB5YXaGg';

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
