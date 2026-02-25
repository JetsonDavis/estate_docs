import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const backendURL = 'http://localhost:8005';

  console.log(`\n🔍 Checking backend at ${backendURL}...`);

  try {
    const response = await fetch(`${backendURL}/docs`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      console.log('✅ Backend is running.\n');
    } else {
      console.error(`\n❌ Backend responded with status ${response.status}. Is it healthy?\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Backend is NOT running at ${backendURL}.`);
    console.error('   Start it with:  uvicorn src.main:app --reload --port 8005');
    console.error('   Then re-run the tests.\n');
    process.exit(1);
  }
}

export default globalSetup;
