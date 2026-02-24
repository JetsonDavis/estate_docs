import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3005';
  const backendURL = 'http://localhost:8005';

  console.log('🧹 Cleaning test database after E2E tests...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login as admin
    await page.goto(`${baseURL}/login`);
    await page.fill('input#username', 'admin');
    await page.fill('input#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to question groups page to ensure session is established
    await page.goto(`${baseURL}/admin/question-groups`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get all question groups with pagination using context.request (shares cookies)
    let allGroups: any[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await context.request.get(`${backendURL}/api/v1/question-groups?page=${currentPage}&per_page=100`);
      
      if (response.ok()) {
        const data = await response.json();
        
        // The response structure has question_groups as the array property
        const groups = Array.isArray(data.question_groups) ? data.question_groups : [];
        allGroups = allGroups.concat(groups);
        
        // Calculate if there are more pages based on total and page_size
        const total = data.total || 0;
        const pageSize = data.page_size || 100;
        const totalPages = Math.ceil(total / pageSize);
        
        console.log(`Page ${currentPage}: found ${groups.length} groups, total: ${total}, pages: ${totalPages}`);
        
        hasMore = currentPage < totalPages;
        currentPage++;
      } else {
        const responseText = await response.text();
        console.log(`⚠️  Failed to fetch page ${currentPage}, status: ${response.status()}, body: ${responseText}`);
        hasMore = false;
      }
    }
    
    console.log(`Found ${allGroups.length} question groups to delete`);

    // Delete all question groups
    let deletedCount = 0;
    for (const group of allGroups) {
      try {
        const deleteResponse = await context.request.delete(`${backendURL}/api/v1/question-groups/${group.id}`);
        if (deleteResponse.ok()) {
          deletedCount++;
        } else {
          console.log(`Failed to delete group ${group.id}, status: ${deleteResponse.status()}`);
        }
      } catch (e) {
        console.log(`Failed to delete group ${group.id}:`, e);
      }
    }

    console.log(`✅ Database cleaned: deleted ${deletedCount} of ${allGroups.length} question groups`);
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    // Don't fail the tests if cleanup fails
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalTeardown;
