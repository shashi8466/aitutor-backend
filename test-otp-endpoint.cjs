// Simple test script to verify OTP endpoint functionality
const https = require('https');

async function testOTPEndpoint() {
    console.log('🔧 Testing OTP Endpoint...\n');

    const testData = {
        phone: '+918466924574'
    };

    const postData = JSON.stringify(testData);

    const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/demo/send-otp',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log(`Status Code: ${res.statusCode}`);
                console.log(`Response: ${data}`);
                
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: data });
                }
            });
        });

        req.on('error', (err) => {
            console.error('Request Error:', err.message);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// Run the test
testOTPEndpoint()
    .then(result => {
        if (result.statusCode === 200) {
            console.log('\n✅ OTP Endpoint is working!');
            console.log('Response:', result.data);
        } else {
            console.log('\n❌ OTP Endpoint returned error:');
            console.log('Status:', result.statusCode);
            console.log('Response:', result.data);
        }
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error.message);
        console.log('\n🔧 Possible issues:');
        console.log('1. Server is not running on port 3001');
        console.log('2. Server has syntax errors and failed to start');
        console.log('3. Network connectivity issues');
        console.log('\n📋 To fix:');
        console.log('1. Check if server started without errors');
        console.log('2. Look for syntax errors in server logs');
        console.log('3. Restart the server with: npm run dev');
    });
