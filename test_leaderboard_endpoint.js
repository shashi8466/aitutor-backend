
const axios = require('axios');

async function testLeaderboard() {
    try {
        const response = await axios.get('http://localhost:3001/api/grading/leaderboard/4');
        console.log("Course 4 Leaderboard:", response.data);
    } catch (e) {
        console.error("Error calling Course 4 Leaderboard:", e.response ? e.response.data : e.message);
    }
}

testLeaderboard();
