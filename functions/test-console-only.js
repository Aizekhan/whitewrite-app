// Simple test: Just open site and show console logs about projectId
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Console Log Test — projectId flow\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Collect ALL logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[Browser] ${text}`);
  });

  console.log('Opening whitewrite-app.web.app...\n');
  await page.goto('https://whitewrite-app.web.app');

  console.log('Waiting 15 seconds for page to load...\n');
  await page.waitForTimeout(15000);

  console.log('\n📊 Key logs about projectId:\n');
  logs.filter(l =>
    l.includes('projectId') ||
    l.includes('Embedded mode') ||
    l.includes('postMessage') ||
    l.includes('__currentProjectId')
  ).forEach(l => console.log(`  ${l}`));

  console.log(`\nTotal logs: ${logs.length}`);
  console.log('Full logs saved to: console-logs-projectid.txt\n');

  require('fs').writeFileSync('console-logs-projectid.txt', logs.join('\n'));

  await browser.close();
})();
