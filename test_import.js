
import('./src/server/routes/upload.js')
    .then(() => console.log('Successfully imported upload.js'))
    .catch(err => {
        console.error('Failed to import upload.js:');
        console.error(err);
    });
