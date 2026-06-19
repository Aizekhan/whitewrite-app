// E2E test: Single project consistency across all pillars
const { chromium } = require('playwright');

const TEST_EMAIL = 'hrytsenkomaksym@gmail.com';
const TEST_PASSWORD = 'Makson2005';

(async () => {
  console.log('🚀 E2E Test: Single Project Consistency Across Pillars\n');

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('__currentProjectId') || text.includes('projectId from') || text.includes('Embedded mode')) {
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

    // Step 2: Open Мадагаскар project directly
    console.log('📦 Step 2: Opening Мадагаскар project...');
    await page.goto('https://whitewrite-app.web.app/#narr');
    await page.waitForTimeout(2000);

    // Click on Мадагаскар project
    await page.click('text=Мадагаскар');
    await page.waitForTimeout(3000);

    console.log('   ✅ Project opened\n');

    // Step 3: Check __currentProjectId across all pillars
    console.log('📋 Step 3: Checking __currentProjectId consistency...\n');

    // Книга (already here)
    const bookProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`   📖 Книга: window.__currentProjectId = "${bookProjectId}"`);

    if (!bookProjectId || bookProjectId === 'undefined' || bookProjectId === 'null') {
      console.error('   ❌ FAIL: Book has invalid projectId!');
      await page.screenshot({ path: 'test-fail-book.png', fullPage: true });
      process.exit(1);
    }

    // Switch to Всесвіт
    console.log('\n   Switching to Всесвіт...');
    await page.click('button:has-text("Всесвіт")');
    await page.waitForTimeout(3000);

    const wtProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`   🌳 Всесвіт: window.__currentProjectId = "${wtProjectId}"`);

    if (wtProjectId !== bookProjectId) {
      console.error(`   ❌ FAIL: WorldTree has different projectId!`);
      console.error(`      Expected: ${bookProjectId}`);
      console.error(`      Got: ${wtProjectId}`);
      await page.screenshot({ path: 'test-fail-worldtree.png', fullPage: true });
      process.exit(1);
    }

    // Check scene dropdown
    console.log('\n   Checking scene dropdown...');
    await page.click('button:has-text("Персонажі")');
    await page.waitForTimeout(1500);

    await page.click('.ws-cat__btn');
    await page.waitForTimeout(1000);

    const sceneCount = await page.locator('.ws-cat__menu .scene-dot').count();
    console.log(`      Found ${sceneCount} scene(s) in dropdown`);

    if (sceneCount === 0) {
      console.error('   ❌ FAIL: No scenes in dropdown!');
      await page.screenshot({ path: 'test-fail-no-scenes.png', fullPage: true });
      process.exit(1);
    }

    console.log(`   ✅ Scene dropdown shows ${sceneCount} scenes`);

    // Switch to Режисер
    console.log('\n   Switching to Режисер...');
    await page.click('button:has-text("Режисер")');
    await page.waitForTimeout(3000);

    const wsProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`   🎬 Режисер: window.__currentProjectId = "${wsProjectId}"`);

    if (wsProjectId !== bookProjectId) {
      console.error(`   ❌ FAIL: Workspace has different projectId!`);
      console.error(`      Expected: ${bookProjectId}`);
      console.error(`      Got: ${wsProjectId}`);
      await page.screenshot({ path: 'test-fail-workspace.png', fullPage: true });
      process.exit(1);
    }

    console.log('\n   ✅ All pillars have SAME projectId\n');

    // Step 4: Check for console errors
    console.log('🔍 Step 4: Checking console for errors...');
    const errors = logs.filter(l =>
      l.toLowerCase().includes('error') ||
      l.includes('Failed') ||
      l.includes('undefined') && l.includes('projectId')
    );

    if (errors.length > 0) {
      console.warn(`   ⚠️  Found ${errors.length} potential errors:`);
      errors.slice(0, 5).forEach(e => console.warn(`     - ${e}`));
    } else {
      console.log('   ✅ No errors in console\n');
    }

    // Step 5: Rapid pillar switching (check for blinking)
    console.log('🔄 Step 5: Testing rapid pillar switching...');
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Книга")');
      await page.waitForTimeout(100);
      await page.click('button:has-text("Всесвіт")');
      await page.waitForTimeout(100);
      await page.click('button:has-text("Режисер")');
      await page.waitForTimeout(100);
    }

    console.log('   ✅ Rapid switching complete (check for menu blinking visually)\n');

    // Final verification
    const finalProjectId = await page.evaluate(() => window.__currentProjectId);
    if (finalProjectId !== bookProjectId) {
      console.error('   ❌ FAIL: projectId changed after rapid switching!');
      process.exit(1);
    }

    console.log(`   ✅ projectId stable: ${finalProjectId}\n`);

    // Screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'test-success-consistency.png', fullPage: true });

    console.log('\n✅ TEST PASSED!\n');
    console.log('Summary:');
    console.log(`  - Single projectId across all pillars: ${bookProjectId} ✅`);
    console.log(`  - Scene dropdown working: ${sceneCount} scenes ✅`);
    console.log(`  - Rapid switching stable ✅`);
    console.log(`  - Console errors: ${errors.length === 0 ? 'None' : errors.length}\n`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-error-consistency.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
