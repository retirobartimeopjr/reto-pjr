#!/bin/bash

# Configuration
URL="https://pjr-app-data.online/map"
CONCURRENCY=3000

echo "🚀 Starting load test: $CONCURRENCY concurrent requests to $URL"
echo "---------------------------------------------------"

# Start time
start_time=$(date +%s%N)

# Loop to fire requests
for ((i=1;i<=CONCURRENCY;i++)); do
    (
        # -s: Silent mode
        # -o /dev/null: Discard response body
        # -w "%{http_code}": Print only the HTTP status code
        response=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
        echo "Request #$i: Status $response"
    ) &
done

# Wait for all background processes to finish
wait

# End time
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

echo "---------------------------------------------------"
echo "✅ Test completed in ${duration}ms"
