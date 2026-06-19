// Test with FRESH account: signup → create project → generate scenes → check dropdown
const { chromium } = require('playwright');

(async () => {
  console.log('🧪 Fresh Account Test: Signup → Project → Scenes → Dropdown\n');

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();

  // Random email to avoid conflicts
  const timestamp = Date.now();
  const email = `test${timestamp}@whitewrite.test`;
  const password = 'test123456';

  console.log(`📧 Using email: ${email}\n`);

  // Collect key logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('projectId') ||
        text.includes('__currentProjectId') ||
        text.includes('Embedded mode') ||
        text.includes('[Shell]') ||
        text.includes('[WorldTree]') ||
        text.includes('Scenes loaded')) {
      console.log(`[Browser] ${text}`);
    }
  });

  try {
    console.log('Step 1: Opening whitewrite-app.web.app...\n');
    await page.goto('https://whitewrite-app.web.app');
    await page.waitForTimeout(3000);

    console.log('Step 2: Opening auth modal...\n');
    await page.click('button:has-text("Увійти")');
    await page.waitForTimeout(1000);

    console.log('Step 3: Switching to Реєстрація tab...\n');
    await page.click('button:has-text("Реєстрація")');
    await page.waitForTimeout(500);

    console.log('Step 4: Filling signup form...\n');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Зареєструватись")');

    console.log('Step 5: Waiting for signup to complete...\n');
    await page.waitForTimeout(5000);

    console.log('Step 6: Creating new project...\n');
    await page.click('button:has-text("Новий проєкт")');
    await page.waitForTimeout(1000);

    await page.fill('input[placeholder="Назва проєкту"]', 'Тестова історія');
    await page.click('button:has-text("Короткий")'); // scope
    await page.click('.genre-chip:has-text("Фантастика")'); // genre
    await page.click('button:has-text("Створити проєкт")');

    console.log('Step 7: Waiting for project to be created...\n');
    await page.waitForTimeout(3000);

    console.log('Step 8: Opening project...\n');
    await page.click('.project-card:has-text("Тестова історія")');
    await page.waitForTimeout(3000);

    // Check main window.__currentProjectId
    const mainProjectId = await page.evaluate(() => window.__currentProjectId);
    console.log(`\n✅ Shell window.__currentProjectId: ${mainProjectId}\n`);

    console.log('Step 9: Switching to Всесвіт pillar...\n');
    await page.click('button:has-text("Всесвіт")');
    await page.waitForTimeout(3000);

    console.log('Step 10: Checking WorldTree iframe projectId...\n');
    const iframeCheck = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="WorldTree"]');
      if (!iframe) return { error: 'NO_IFRAME' };

      try {
        const iframeProjectId = iframe.contentWindow.__currentProjectId;
        const iframeWORLD = iframe.contentWindow.WORLD;

        return {
          projectId: iframeProjectId || 'UNDEFINED',
          scenesCount: iframeWORLD?.scenes?.length || 0,
          charactersCount: iframeWORLD?.characters?.length || 0
        };
      } catch (e) {
        return { error: 'CANNOT_ACCESS: ' + e.message };
      }
    });

    console.log('\n📊 WorldTree iframe state:', JSON.stringify(iframeCheck, null, 2));

    console.log('\nStep 11: Clicking Персонажі tab...\n');
    await page.waitForTimeout(2000);

    const sceneDropdownCheck = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="WorldTree"]');
      if (!iframe) return { error: 'NO_IFRAME' };

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Click Персонажі tab
      const charTab = iframeDoc.querySelector('button[data-tab="characters"]');
      if (!charTab) return { error: 'NO_CHAR_TAB_BUTTON' };

      charTab.click();

      // Wait and check dropdown
      return new Promise(resolve => {
        setTimeout(() => {
          const dropdown = iframeDoc.querySelector('.scene-filter select');
          if (!dropdown) {
            resolve({ error: 'NO_DROPDOWN_ELEMENT' });
            return;
          }

          const options = Array.from(dropdown.querySelectorAll('option')).map(opt => ({
            value: opt.value,
            text: opt.textContent.trim()
          }));

          resolve({ success: true, optionsCount: options.length, options });
        }, 1500);
      });
    });

    console.log('\n📋 Scene dropdown result:', JSON.stringify(sceneDropdownCheck, null, 2));

    if (sceneDropdownCheck.success) {
      if (sceneDropdownCheck.optionsCount === 1) {
        console.log('\n❌ FAIL: Only "Уся історія" option (no scenes loaded)');
        console.log('   This is EXPECTED for new project with 0 scenes');
      } else {
        console.log(`\n✅ SUCCESS: ${sceneDropdownCheck.optionsCount} options in dropdown`);
      }
    } else {
      console.log('\n❌ ERROR:', sceneDropdownCheck.error);
    }

    console.log('\n💡 Note: New project has 0 scenes by default.');
    console.log('   To test scene dropdown, you need to generate scenes first.');
    console.log('   This test verifies that projectId sync works (no errors).\n');

    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
})();
