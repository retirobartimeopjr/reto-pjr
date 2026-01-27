


const BASE_URL = 'http://localhost:3000';
const TOTAL_REQUESTS = 1000;
const CONCURRENCY_LIMIT = 20;

// Test credentials
const PHONE = '3123415728';
const CODE = 'CZ50';

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLoginTests() {
    console.log(`Starting Login Load Test: ${TOTAL_REQUESTS} requests...`);
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();

    // Since these are read operations, we can blast them or limit concurrency.
    // Spec says "mil usuarios intentando", usually implies high concurrency.
    // let's do batches of 50 to be reasonable but fast.
    const batchSize = 50;

    for (let i = 0; i < TOTAL_REQUESTS; i += batchSize) {
        const batch = [];
        const limit = Math.min(i + batchSize, TOTAL_REQUESTS);

        for (let j = i; j < limit; j++) {
            batch.push(
                fetch(`${BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: PHONE, code: CODE })
                }).then(res => {
                    if (res.ok) successCount++;
                    else failCount++;
                }).catch(() => failCount++)
            );
        }
        await Promise.all(batch);
        process.stdout.write(`\rProgress: ${limit}/${TOTAL_REQUESTS}`);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nLogin Test Completed in ${duration.toFixed(2)}s`);
    console.log(`Success: ${successCount}, Failed: ${failCount}`);
    console.log(`RPS: ${(TOTAL_REQUESTS / duration).toFixed(2)}\n`);
}

async function runWriteTests() {
    console.log(`Starting Write Load Test: ${TOTAL_REQUESTS} requests, ${CONCURRENCY_LIMIT} threads...`);
    let completed = 0;
    let active = 0;
    let nextIndex = 1;
    const startTime = Date.now();
    const results = [];

    const worker = async () => {
        while (nextIndex <= TOTAL_REQUESTS) {
            const id = nextIndex++;
            try {
                const res = await fetch(`${BASE_URL}/api/test-write`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, timestamp: new Date().toISOString() })
                });
                if (res.ok) results.push({ id, status: 'success' });
                else results.push({ id, status: 'fail' });
            } catch (err) {
                results.push({ id, status: 'error' });
            }

            completed++;
            if (completed % 50 === 0) {
                process.stdout.write(`\rProgress: ${completed}/${TOTAL_REQUESTS}`);
            }
        }
    };

    const workers = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nWrite Test Completed in ${duration.toFixed(2)}s`);
    console.log(`RPS: ${(TOTAL_REQUESTS / duration).toFixed(2)}\n`);
}

async function main() {
    // Check if server is up
    try {
        await fetch(BASE_URL);
    } catch (e) {
        console.error("Server not running at " + BASE_URL);
        process.exit(1);
    }

    console.log("=== API LOAD TESTING ===");
    await runLoginTests();
    await delay(2000);
    await runWriteTests();
}

main();
