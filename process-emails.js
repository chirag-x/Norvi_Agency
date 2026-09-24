async function run() {
  console.log("Triggering Outbox Email Processor...");
  try {
    const res = await fetch('http://127.0.0.1:4321/api/internal/process-outbox', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer local-cron-secret-123',
        'Origin': 'http://127.0.0.1:4321'
      }
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed (${res.status}): ${text}`);
      return;
    }
    
    const data = await res.json();
    console.log("Outbox processed successfully!");
    console.log(data);
  } catch (err) {
    console.error("Error connecting to server. Is the server running on port 4321?", err);
  }
}

run();
