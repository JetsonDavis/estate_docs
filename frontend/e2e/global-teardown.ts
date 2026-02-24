import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3005';
  const backendURL = 'http://localhost:8005';

  console.log('🧹 Cleaning test database after E2E tests...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Login as admin
    await page.goto(`${baseURL}/login`);
    await page.fill('input#username', 'admin');
    await page.fill('input#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Get all question groups
    const response = await page.request.get(`${backendURL}/api/v1/question-groups?page=1&per_page=1000`);
    
    if (response.ok()) {
      const data = await response.json();
      const groups = data.items || [];
      
      console.log(`Found ${groups.length} question groups to delete`);

      // Delete all question groups
      for (const group of groups) {
        try {
          await page.request.delete(`${backendURL}/api/v1/question-groups/${group.id}`);
        } catch (e) {
          console.log(`Failed to delete group ${group.id}:`, e);
        }
      }

      console.log('✅ Database cleaned successfully');
    } else {
      console.log('⚠️  Could not fetch question groups, database may not be clean');
    }
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    // Don't fail the tests if cleanup fails
  } finally {
    await browser.close();
  }
}

export default globalTeardown;
