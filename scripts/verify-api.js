
import fetch from 'node-fetch';

async function verify() {
    try {
        const res = await fetch('http://localhost:3000/api/parroquias');
        const data = await res.json();
        console.log(`API returned ${data.length} parroquias.`);

        if (data.length > 0) {
            console.log("First item:", data[0]);
        }
    } catch (e) {
        console.error("Verification failed:", e);
    }
}

verify();
