// Check console logs from production to debug the issue
const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Checking console logs from whitewrite-app.web.app\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[Console] ${text}`);
  });

  try {
    console.log('Opening https://whitewrite-app.web.app...');
    await page.goto('https://whitewrite-app.web.app', { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    console.log('\n📊 Analysis of logs:');

    // Check if scenes were loaded
    const scenesLoaded = logs.find(l => l.includes('Scenes loaded:'));
    if (scenesLoaded) {
      console.log('✅', scenesLoaded);
    } else {
      console.log('❌ No "Scenes loaded" log found');
    }

    // Check if postMessage was sent
    const postMessageSent = logs.find(l => l.includes('[Shell] Sent projectId to iframe:'));
    if (postMessageSent) {
      console.log('✅', postMessageSent);
    } else {
      console.log('❌ No postMessage sent');
    }

    // Check if embedded mode wait happened
    const embeddedWait = logs.find(l => l.includes('Embedded mode — waiting'));
    if (embeddedWait) {
      console.log('✅', embeddedWait);
    } else {
      console.log('❌ No embedded wait log');
    }

    // Check received projectId
    const receivedProjectId = logs.find(l => l.includes('Received projectId from shell after wait:'));
    if (receivedProjectId) {
      console.log('✅', receivedProjectId);
    } else {
      console.log('❌ No "Received projectId from shell" log');
    }

    console.log(`\n📝 Total logs: ${logs.length}`);
    console.log('Full logs saved to console-logs.txt');

    // Save to file
    require('fs').writeFileSync('console-logs.txt', logs.join('\n'));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
