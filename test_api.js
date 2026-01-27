
import fs from 'fs';

async function test() {
    try {
        console.log('Fetching...');
        const res = await fetch('http://localhost:3000/api/parroquias');
        console.log('Status:', res.status);
        const data = await res.json();
        fs.writeFileSync('api_result.json', JSON.stringify(data, null, 2));
    } catch (e) {
        fs.writeFileSync('api_result.json', JSON.stringify({ error: e.message }));
    }
}

test();
