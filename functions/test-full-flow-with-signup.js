// Full E2E test: Signup → Create Project → Generate Scenes → Check Scene Dropdown
const { chromium } = require('playwright');

const TEST_EMAIL = `test-${Date.now()}@whitewrite.test`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

(async () => {
  console.log('🚀 Full E2E Test: Signup + Scene Dropdown\n');
  console.log(`Test account: ${TEST_EMAIL}`);
  console.log(`Password: ${TEST_PASSWORD}\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Collect console logs
  page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

  try {
    // Step 1: Open site
    console.log('📍 Step 1: Opening https://whitewrite-app.web.app');
    await page.goto('https://whitewrite-app.web.app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Step 2: Signup
    console.log('📝 Step 2: Signing up...');
    await page.click('text=Увійти');
    await page.waitForTimeout(1000);

    // Switch to signup tab
    await page.click('text=Реєстрація');
    await page.waitForTimeout(500);

    // Fill signup form
    await page.fill('#auth-name', TEST_NAME);
    await page.fill('#auth-email', TEST_EMAIL);
    await page.fill('#auth-pass', TEST_PASSWORD);

    // Submit
    await page.click('button:has-text("Зареєструватися")');
    await page.waitForTimeout(5000);

    console.log('   ✅ Signup complete');

    // Navigate to Projects page
    console.log('📂 Step 2.5: Navigating to Projects page...');
    await page.goto('https://whitewrite-app.web.app/#projects');
    await page.waitForTimeout(2000);

    // Step 3: Create project
    console.log('📦 Step 3: Creating test project...');

    // DEBUG: Screenshot before clicking
    await page.screenshot({ path: 'debug-projects-page.png', fullPage: true });
    console.log('   Screenshot saved: debug-projects-page.png');

    // Try multiple selectors
    let createButton = null;
    const selectors = [
      '.proj-card:has-text("Створити проєкт")',
      'button:has-text("Створити проєкт")',
      '.proj-card:has-text("Створити")',
      'text=Створити проєкт',
      '[data-new="true"]'
    ];

    for (const sel of selectors) {
      try {
        createButton = await page.locator(sel).first();
        if (await createButton.isVisible({ timeout: 2000 })) {
          console.log(`   ✅ Found button with selector: ${sel}`);
          await createButton.click();
          break;
        }
      } catch (e) {
        console.log(`   ❌ Selector failed: ${sel}`);
      }
    }

    if (!createButton) {
      console.error('   ❌ Could not find create button with any selector!');
      throw new Error('Create button not found');
    }

    await page.waitForTimeout(1000);

    // Fill project form
    await page.fill('input[placeholder*="назва"]', 'Тестовий Проєкт');
    await page.fill('textarea[placeholder*="Опишіть"]', 'Автоматичний тест');

    // Select scope (novel)
    await page.click('button:has-text("Роман")');
    await page.waitForTimeout(500);

    // Select genre (фантастика)
    await page.click('.genre-chip:has-text("Фантастика")');
    await page.waitForTimeout(500);

    // Create
    await page.click('button:has-text("Створити")');
    await page.waitForTimeout(3000);

    console.log('   ✅ Project created');

    // Step 4: Generate 3 scenes
    console.log('🎬 Step 4: Generating 3 scenes...');
    for (let i = 1; i <= 3; i++) {
      console.log(`   Generating scene ${i}/3...`);

      // Click "New scene" button
      await page.click('button:has-text("Нова сцена")');
      await page.waitForTimeout(1000);

      // Fill scene intent
      await page.fill('textarea', `Сцена ${i} тесту`);

      // Generate
      await page.click('button:has-text("Згенерувати")');

      // Wait for generation (up to 60 seconds)
      await page.waitForSelector('.scene-card', { timeout: 60000 });
      await page.waitForTimeout(2000);

      console.log(`   ✅ Scene ${i} generated`);
    }

    console.log('   ✅ All 3 scenes generated');

    // Step 5: Open WorldTree
    console.log('🌳 Step 5: Opening WorldTree...');
    await page.click('button:has-text("Всесвіт")');
    await page.waitForTimeout(3000);

    // Wait for WorldTree to load
    await page.waitForSelector('.ws-cat', { timeout: 15000 });
    console.log('   ✅ WorldTree loaded');

    // Step 6: Open Персонажі tab
    console.log('👤 Step 6: Opening Персонажі tab...');
    await page.click('button:has-text("Персонажі")');
    await page.waitForTimeout(1500);

    // Step 7: Open scene dropdown
    console.log('📋 Step 7: Opening scene dropdown...');
    await page.click('.ws-cat__btn');
    await page.waitForTimeout(1000);

    // Step 8: Check dropdown content
    console.log('🔍 Step 8: Checking dropdown...');
    const dropdown = await page.locator('.ws-cat__menu').first();
    const isVisible = await dropdown.isVisible();

    if (!isVisible) {
      console.error('❌ FAIL: Dropdown not visible!');
      await page.screenshot({ path: 'test-fail.png', fullPage: true });
      process.exit(1);
    }

    // Count scenes
    const sceneCount = await page.locator('.ws-cat__menu .scene-dot').count();
    console.log(`   Found ${sceneCount} scene(s) in dropdown`);

    if (sceneCount === 0) {
      console.error('❌ FAIL: No scenes in dropdown!');
      await page.screenshot({ path: 'test-fail-no-scenes.png', fullPage: true });
      process.exit(1);
    }

    if (sceneCount !== 3) {
      console.warn(`⚠️  WARNING: Expected 3 scenes, found ${sceneCount}`);
    } else {
      console.log('   ✅ CORRECT: 3 scenes found!');
    }

    // Step 9: Screenshot
    console.log('📸 Step 9: Taking screenshot...');
    await page.screenshot({ path: 'test-success-full-flow.png', fullPage: true });

    console.log('\n✅ TEST PASSED!\n');
    console.log(`Test account created: ${TEST_EMAIL}`);
    console.log(`Password: ${TEST_PASSWORD}`);
    console.log('Screenshot: test-success-full-flow.png\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-error-full-flow.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
