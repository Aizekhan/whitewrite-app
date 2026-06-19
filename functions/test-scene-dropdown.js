// Automated test: Scene dropdown in WorldTree
const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting automated test: Scene dropdown in WorldTree\n');

  const browser = await chromium.launch({ headless: false }); // Show browser
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 1. Navigate to production
    console.log('📍 Step 1: Opening https://whitewrite-app.web.app');
    await page.goto('https://whitewrite-app.web.app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 2. Login (if not already logged in)
    console.log('🔐 Step 2: Checking auth state...');
    const isLoggedIn = await page.evaluate(() => !!window.__wwAuth);

    if (!isLoggedIn) {
      console.log('   Logging in...');
      // Click login button
      await page.click('text=Увійти');
      await page.waitForTimeout(1000);

      // Fill credentials
      await page.fill('#auth-email', 'hrytsenkomaksym@gmail.com');
      await page.fill('#auth-pass', 'YOUR_PASSWORD_HERE'); // NEED PASSWORD
      await page.click('button:has-text("Увійти")');
      await page.waitForTimeout(3000);
    } else {
      console.log('   ✅ Already logged in');
    }

    // 3. Open Мадагаскар project
    console.log('📦 Step 3: Opening Мадагаскар project...');
    await page.click('text=Мадагаскар');
    await page.waitForTimeout(3000);

    // 4. Click "Всесвіт" button
    console.log('🌳 Step 4: Clicking "Всесвіт" button...');
    await page.click('button:has-text("Всесвіт")');
    await page.waitForTimeout(2000);

    // Wait for WorldTree to load
    await page.waitForSelector('.ws-cat', { timeout: 10000 });
    console.log('   ✅ WorldTree loaded');

    // 5. Click "Персонажі" tab
    console.log('👤 Step 5: Clicking "Персонажі" tab...');
    await page.click('button:has-text("Персонажі")');
    await page.waitForTimeout(1000);

    // 6. Click scene dropdown
    console.log('🎬 Step 6: Opening scene dropdown...');
    const dropdownButton = await page.locator('.ws-cat__btn').first();
    await dropdownButton.click();
    await page.waitForTimeout(1000);

    // 7. Check if dropdown has scenes
    console.log('🔍 Step 7: Checking dropdown content...');
    const dropdownMenu = await page.locator('.ws-cat__menu').first();
    const isVisible = await dropdownMenu.isVisible();

    if (!isVisible) {
      console.error('❌ FAIL: Dropdown menu not visible!');
      await page.screenshot({ path: 'test-fail-dropdown-not-visible.png' });
      process.exit(1);
    }

    // Count scene items (excluding "Уся історія")
    const sceneItems = await page.locator('.ws-cat__menu button .scene-dot').count();
    console.log(`   Found ${sceneItems} scene(s) in dropdown`);

    if (sceneItems === 0) {
      console.error('❌ FAIL: No scenes in dropdown!');
      await page.screenshot({ path: 'test-fail-no-scenes.png', fullPage: true });

      // Debug: check console logs
      const logs = await page.evaluate(() => {
        return {
          currentProjectId: window.__currentProjectId,
          scenesInWORLD: window.WORLD?.scenes?.length || 0
        };
      });
      console.error('Debug info:', logs);

      process.exit(1);
    }

    if (sceneItems !== 3) {
      console.warn(`⚠️  WARNING: Expected 3 scenes, found ${sceneItems}`);
    } else {
      console.log('   ✅ CORRECT: 3 scenes found!');
    }

    // 8. Screenshot success
    console.log('📸 Step 8: Taking screenshot...');
    await page.screenshot({ path: 'test-success-scene-dropdown.png', fullPage: true });

    console.log('\n✅ TEST PASSED!\n');
    console.log('Screenshots saved:');
    console.log('  - test-success-scene-dropdown.png');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
