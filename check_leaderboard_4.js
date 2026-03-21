
import axios from 'axios';

async function checkLeaderboard() {
    try {
        const response = await axios.get('http://localhost:3001/api/grading/leaderboard/4');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
checkLeaderboard();
