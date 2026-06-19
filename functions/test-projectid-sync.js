// Test: Open project → verify window.__currentProjectId is synced across all pillars
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Testing projectId synchronization across pillars\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);

    // Show key logs
    if (text.includes('projectId') ||
        text.includes('__currentProjectId') ||
        text.includes('Embedded mode') ||
        text.includes('[Shell]')) {
      console.log(`[Browser] ${text}`);
    }
  });

  console.log('Step 1: Opening whitewrite-app.web.app...\n');
  await page.goto('https://whitewrite-app.web.app');

  console.log('Step 2: Waiting for Firebase auth...\n');
  await page.waitForTimeout(3000);

  console.log('Step 3: Logging in...\n');
  await page.click('.dock__btn--account');
  await page.waitForTimeout(500);

  await page.fill('input[type="email"]', 'test@whitewrite.com');
  await page.fill('input[type="password"]', 'test123456');
  await page.click('button:has-text("Увійти")');

  console.log('Step 4: Waiting for projects to load...\n');
  await page.waitForTimeout(5000);

  console.log('Step 5: Opening Мадагаскар project...\n');
  await page.click('.project-card:has-text("Мадагаскар")');

  console.log('Step 6: Waiting for book to load...\n');
  await page.waitForTimeout(3000);

  // Check window.__currentProjectId in main page
  const mainProjectId = await page.evaluate(() => window.__currentProjectId);
  console.log(`\n✅ Main page window.__currentProjectId: ${mainProjectId}\n`);

  console.log('Step 7: Switching to Всесвіт pillar...\n');
  await page.click('button:has-text("Всесвіт")');
  await page.waitForTimeout(3000);

  // Check projectId in WorldTree iframe
  const iframeProjectId = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="WorldTree"]');
    if (!iframe) return 'NO_IFRAME';
    try {
      return iframe.contentWindow.__currentProjectId || 'UNDEFINED_IN_IFRAME';
    } catch (e) {
      return 'CANNOT_ACCESS: ' + e.message;
    }
  });
  console.log(`✅ WorldTree iframe window.__currentProjectId: ${iframeProjectId}\n`);

  console.log('Step 8: Checking scene dropdown in Персонажі tab...\n');

  // Wait for iframe to load
  await page.waitForTimeout(2000);

  // Click Персонажі tab inside WorldTree iframe
  const scenesFound = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="WorldTree"]');
    if (!iframe) return { error: 'NO_IFRAME' };

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const charTab = iframeDoc.querySelector('button[data-tab="characters"]');

    if (!charTab) return { error: 'NO_CHAR_TAB' };
    charTab.click();

    // Wait for dropdown to render
    return new Promise(resolve => {
      setTimeout(() => {
        const dropdown = iframeDoc.querySelector('.scene-filter select');
        if (!dropdown) {
          resolve({ error: 'NO_DROPDOWN' });
          return;
        }

        const options = Array.from(dropdown.querySelectorAll('option')).map(opt => ({
          value: opt.value,
          text: opt.textContent
        }));

        resolve({ options });
      }, 1000);
    });
  });

  console.log('\n📊 Scene dropdown options:', JSON.stringify(scenesFound, null, 2));

  if (scenesFound.options && scenesFound.options.length > 1) {
    console.log('\n✅ SUCCESS: Scene dropdown has multiple options!');
  } else {
    console.log('\n❌ FAIL: Scene dropdown only has "Уся історія"');
  }

  console.log('\n📋 Key logs about projectId:');
  logs.filter(l =>
    l.includes('projectId') ||
    l.includes('__currentProjectId') ||
    l.includes('Embedded mode')
  ).forEach(l => console.log(`  ${l}`));

  await page.waitForTimeout(5000);
  await browser.close();
})();
