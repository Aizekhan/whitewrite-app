// Simple: just open site and dump all console logs
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Collect ALL logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[WorldTree]') || text.includes('[Shell]') || text.includes('Scenes')) {
      console.log(`✨ ${text}`);
    }
  });

  console.log('Opening whitewrite-app.web.app...\n');
  await page.goto('https://whitewrite-app.web.app');

  console.log('Waiting 15 seconds for page to load...\n');
  await page.waitForTimeout(15000);

  console.log('\n📊 Key logs:\n');
  logs.filter(l =>
    l.includes('Embedded') ||
    l.includes('postMessage') ||
    l.includes('Scenes loaded') ||
    l.includes('currentProjectId') ||
    l.includes('[WorldTree]') ||
    l.includes('[Shell]')
  ).forEach(l => console.log(`  ${l}`));

  console.log(`\nTotal logs: ${logs.length}`);
  console.log('Full logs saved to: console-dump.txt\n');

  require('fs').writeFileSync('console-dump.txt', logs.join('\n'));

  await browser.close();
})();
