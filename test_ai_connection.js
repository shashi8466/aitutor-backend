import axios from 'axios';

async function testAI() {
    try {
        console.log('Testing AI connection...');
        const response = await axios.post('http://localhost:3001/api/ai/chat', {
            message: 'Hello',
            context: 'You are a test assistant',
            difficulty: 'Easy'
        });
        console.log('AI Response:', response.data);
    } catch (error) {
        console.error('AI Test Failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testAI();
