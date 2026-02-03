
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const BACKEND_URL = 'http://localhost:3001';

async function testApi() {
    console.log("🧪 Testing /api/grading/submission/7...");
    try {
        // We need an auth token or we need to bypass it if testing locally and server allows it
        // Since I'm on the same machine, I can try to find a token or just mock the req.user in code if I were editing
        // But let's try to just hit it.
        const response = await axios.get(`${BACKEND_URL}/api/grading/submission/7`);
        console.log("✅ Success!");
        const sub = response.data.submission;
        console.log("📊 Stats:", {
            total: sub.incorrect_responses.length + sub.correct_responses.length,
            incorrect: sub.incorrect_responses.length,
            correct: sub.correct_responses.length,
            score: sub.scaled_score
        });
    } catch (err) {
        console.error("❌ Failed:", err.response?.status, err.response?.data || err.message);
    }
}

testApi();
