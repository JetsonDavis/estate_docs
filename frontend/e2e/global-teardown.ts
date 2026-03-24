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
    
    // Only delete groups created by tests (matching known test naming patterns)
    // NEVER delete pre-existing / user-created groups
    const testNamePatterns = [
      /^ConditionalDelete_/,
      /^ConditionalValue_/,
      /^MultiLevel_/,
      /^Operators_/,
      /^DelTest\d+_/,
      /^InsertBeginning_/,
      /^InsertMiddle_/,
      /^MultiOps_/,
      /^DeletePreserveOrder_/,
      /^AddAfterConditional_/,
      /^Repeatable_/,
      /^ToggleRepeatable_/,
      /^MultiCheckbox_/,
      /^RepeatableConditional_/,
      /^InsertCond_/,
      /^TestGroup_/,
      /^E2E_/,
      /^Comprehensive_/,
      /^RapidCreate_/,
      /^PersistMeta_/,
      /^RandomOps_/,
      /^BugRegression_/,
      /^RapidCycle_/,
      /^MixedInsert_/,
      /^StressTest_/,
      /^NestedPersist_/,
      /^Metadata_/,
      /^Complex_/,
      /^Test Group /,
      /^NestedCondRepeat_/,
      /^ncr10_/,
      /^RapidOps_/,
      /^Stress Test /,
      /^Order Test /,
      /^Rapid Test /,
      /^Regression Test /,
      /^repeat_persist$/,
      /^ForeachTest_/,
      /^ForeachPerson/,
      /^ForeachWhere/,
      /^ForeachPersonTmpl_/,
      /^ForeachWhereTmpl_/,
      /^DebugGrp/,
    ];

    const testGroups = allGroups.filter(g =>
      testNamePatterns.some(pattern => pattern.test(g.name))
    );
    const skippedCount = allGroups.length - testGroups.length;

    console.log(`Found ${allGroups.length} total groups, ${testGroups.length} are test-created, skipping ${skippedCount} pre-existing`);

    // Delete only test-created groups
    let deletedCount = 0;
    for (const group of testGroups) {
      try {
        const deleteResponse = await context.request.delete(`${backendURL}/api/v1/question-groups/${group.id}`);
        if (deleteResponse.ok()) {
          deletedCount++;
        } else {
          console.log(`Failed to delete group ${group.id} (${group.name}), status: ${deleteResponse.status()}`);
        }
      } catch (e) {
        console.log(`Failed to delete group ${group.id}:`, e);
      }
    }

    console.log(`✅ Cleanup done: deleted ${deletedCount} test groups, preserved ${skippedCount} pre-existing groups`);

    // Clean up test-created sessions
    const testSessionPatterns = [
      /^NestedCondTest_/,
      /^E2E_/,
      /^TestSession_/,
      /^ForeachClient_/,
      /^ForeachPersonClient_/,
      /^ForeachWhereClient_/,
    ];

    try {
      const sessionsResponse = await context.request.get(`${backendURL}/api/v1/sessions/`);
      if (sessionsResponse.ok()) {
        const sessions = await sessionsResponse.json();
        const allSessions = Array.isArray(sessions) ? sessions : [];
        const testSessions = allSessions.filter((s: any) =>
          testSessionPatterns.some(pattern => pattern.test(s.client_identifier || ''))
        );

        let deletedSessions = 0;
        for (const session of testSessions) {
          try {
            const delResp = await context.request.delete(`${backendURL}/api/v1/sessions/${session.id}`);
            if (delResp.ok()) deletedSessions++;
          } catch (e) {
            // ignore individual session delete failures
          }
        }
        console.log(`✅ Session cleanup: deleted ${deletedSessions} test sessions, preserved ${allSessions.length - testSessions.length} pre-existing sessions`);
      }
    } catch (e) {
      console.log('⚠️  Session cleanup failed:', e);
    }

    // Clean up test-created templates
    const testTemplatePatterns = [/^E2E_/, /^ForeachTemplate_/, /^ForeachPersonTmpl_/, /^ForeachWhereTmpl_/];
    try {
      const templatesResponse = await context.request.get(`${backendURL}/api/v1/templates/?page=1&page_size=100`);
      if (templatesResponse.ok()) {
        const data = await templatesResponse.json();
        const allTemplates = Array.isArray(data.templates) ? data.templates : [];
        const testTemplates = allTemplates.filter((t: any) =>
          testTemplatePatterns.some(pattern => pattern.test(t.name || ''))
        );

        let deletedTemplates = 0;
        for (const tmpl of testTemplates) {
          try {
            const delResp = await context.request.delete(`${backendURL}/api/v1/templates/${tmpl.id}`);
            if (delResp.ok()) deletedTemplates++;
          } catch (e) { /* ignore */ }
        }
        console.log(`✅ Template cleanup: deleted ${deletedTemplates} test templates, preserved ${allTemplates.length - testTemplates.length} pre-existing templates`);
      }
    } catch (e) {
      console.log('⚠️  Template cleanup failed:', e);
    }
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
    // Don't fail the tests if cleanup fails
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalTeardown;
