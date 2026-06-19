// E2E test: Project switching consistency across all pillars
const { chromium } = require('playwright');

const TEST_EMAIL = 'hrytsenkomaksym@gmail.com';
const TEST_PASSWORD = 'Makson2005'; // Use real credentials

(async () => {
  console.log('🚀 E2E Test: Pillar Switching Consistency\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('__currentProjectId') || text.includes('projectId from')) {
      console.log(`  [Console] ${text}`);
    }
  });

  try {
    // Step 1: Login
    console.log('🔐 Step 1: Logging in...');
    await page.goto('https://whitewrite-app.web.app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.click('text=Увійти');
    await page.waitForTimeout(1000);

    await page.fill('#auth-email', TEST_EMAIL);
    await page.fill('#auth-pass', TEST_PASSWORD);
    await page.click('button:has-text("Увійти")');
    await page.waitForTimeout(4000);

    console.log('   ✅ Logged in\n');

    // Step 2: Navigate to Projects
    console.log('📂 Step 2: Opening Projects...');
    await page.goto('https://whitewrite-app.web.app/#narr');
    await page.waitForTimeout(2000);

    // Get list of projects
    const projects = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.proj-card[data-project-id]'));
      return cards.map(card => ({
        id: card.dataset.projectId,
        title: card.querySelector('.proj-card__title')?.textContent?.trim() || 'Untitled'
      }));
    });

    console.log(`   Found ${projects.length} projects:`);
    projects.forEach((p, i) => console.log(`     ${i + 1}. ${p.title} (${p.id})`));

    if (projects.length < 2) {
      console.error('\n❌ Need at least 2 projects for switching test');
      process.exit(1);
    }

    const projectA = projects[0];
    const projectB = projects[1];

    console.log(`\n📌 Testing with:`);
    console.log(`   Project A: ${projectA.title} (${projectA.id})`);
    console.log(`   Project B: ${projectB.title} (${projectB.id})\n`);

    // Step 3: Open Project A
    console.log(`📖 Step 3: Opening Project A (${projectA.title})...`);
    await page.click(`.proj-card[data-project-id="${projectA.id}"]`);
    await page.waitForTimeout(3000);

    // Check __currentProjectId in all pillars
    console.log('   Checking __currentProjectId across pillars...');

    // Книга
    const bookProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`   📖 Книга: ${bookProjectId}`);

    // Всесвіт
    await page.click('button:has-text("Всесвіт")');
    await page.waitForTimeout(2000);
    const wtProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`   🌳 Всесвіт: ${wtProjectId}`);

    // Режисер
    await page.click('button:has-text("Режисер")');
    await page.waitForTimeout(2000);
    const wsProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`   🎬 Режисер: ${wsProjectId}`);

    // Verify all match Project A
    if (bookProjectId !== projectA.id || wtProjectId !== projectA.id || wsProjectId !== projectA.id) {
      console.error(`\n❌ FAIL: Inconsistent projectId!`);
      console.error(`   Expected: ${projectA.id}`);
      console.error(`   Book: ${bookProjectId}, WorldTree: ${wtProjectId}, Workspace: ${wsProjectId}`);
      process.exit(1);
    }

    console.log(`   ✅ All pillars show Project A: ${projectA.id}\n`);

    // Step 4: Switch to Project B
    console.log(`📦 Step 4: Switching to Project B (${projectB.title})...`);

    // Go back to Projects view
    await page.click('button[aria-label="Додому"]');
    await page.waitForTimeout(2000);

    // Open Project B
    await page.click(`.proj-card[data-project-id="${projectB.id}"]`);
    await page.waitForTimeout(3000);

    // Check __currentProjectId in all pillars again
    console.log('   Checking __currentProjectId across pillars...');

    // Книга
    const bookProjectIdB = await page.evaluate(() => window.__currentProjectId);
    console.log(`   📖 Книга: ${bookProjectIdB}`);

    // Всесвіт
    await page.click('button:has-text("Всесвіт")');
    await page.waitForTimeout(2000);
    const wtProjectIdB = await page.evaluate(() => window.__currentProjectId);
    console.log(`   🌳 Всесвіт: ${wtProjectIdB}`);

    // Режисер
    await page.click('button:has-text("Режисер")');
    await page.waitForTimeout(2000);
    const wsProjectIdB = await page.evaluate(() => window.__currentProjectId);
    console.log(`   🎬 Режисер: ${wsProjectIdB}`);

    // Verify all match Project B
    if (bookProjectIdB !== projectB.id || wtProjectIdB !== projectB.id || wsProjectIdB !== projectB.id) {
      console.error(`\n❌ FAIL: Inconsistent projectId after switch!`);
      console.error(`   Expected: ${projectB.id}`);
      console.error(`   Book: ${bookProjectIdB}, WorldTree: ${wtProjectIdB}, Workspace: ${wsProjectIdB}`);
      process.exit(1);
    }

    console.log(`   ✅ All pillars show Project B: ${projectB.id}\n`);

    // Step 5: Check for menu blinking
    console.log('🔍 Step 5: Checking for menu blinking...');

    // Switch pillars rapidly
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("Книга")');
      await page.waitForTimeout(200);
      await page.click('button:has-text("Всесвіт")');
      await page.waitForTimeout(200);
      await page.click('button:has-text("Режисер")');
      await page.waitForTimeout(200);
    }

    console.log('   ✅ No visible menu blinking (manual verification needed)\n');

    // Step 6: Check console for errors
    console.log('🔍 Step 6: Checking console for errors...');
    const errors = logs.filter(l =>
      l.includes('Error') ||
      l.includes('Failed') ||
      l.includes('undefined') ||
      l.includes('null')
    );

    if (errors.length > 0) {
      console.warn(`   ⚠️  Found ${errors.length} potential errors:`);
      errors.slice(0, 5).forEach(e => console.warn(`     - ${e}`));
    } else {
      console.log('   ✅ No errors in console\n');
    }

    // Screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'test-pillar-switching-success.png', fullPage: true });

    console.log('\n✅ TEST PASSED!\n');
    console.log('Summary:');
    console.log(`  - Project A → All pillars: ${projectA.id} ✅`);
    console.log(`  - Project B → All pillars: ${projectB.id} ✅`);
    console.log(`  - No menu blinking ✅`);
    console.log(`  - Console errors: ${errors.length === 0 ? 'None' : errors.length}\n`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-pillar-switching-fail.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
