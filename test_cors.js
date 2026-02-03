import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/enrollment/key/1',
    method: 'OPTIONS',
    headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH'
    }
};

const req = http.request(options, (res) => {
    console.log('StatusCode:', res.statusCode);
    console.log('Access-Control-Allow-Methods:', res.headers['access-control-allow-methods']);
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
