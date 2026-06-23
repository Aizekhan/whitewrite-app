// Test script to capture console logs from pagination
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPagination() {
  console.log('🚀 Starting pagination test...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect all console logs
  const logs = {
    all: [],
    errors: [],
    warnings: [],
    pagination: []
  };

  page.on('console', msg => {
    const text = msg.text();
    logs.all.push(text);

    if (msg.type() === 'error') {
      logs.errors.push(text);
    } else if (msg.type() === 'warning') {
      logs.warnings.push(text);
    }

    // Capture pagination-related logs
    if (text.includes('PAGINATION') ||
        text.includes('paginateSceneDOM') ||
        text.includes('Probe vs Real') ||
        text.includes('Para ') ||
        text.includes('Page ') ||
        text.includes('Spread logic') ||
        text.includes('paragraphs accounted')) {
      logs.pagination.push(text);
      console.log(text);
    }
  });

  page.on('pageerror', error => {
    console.error('❌ Page error:', error.message);
    logs.errors.push(error.message);
  });

  // Navigate to WhiteWrite.html
  const htmlPath = 'file:///' + path.resolve(__dirname, 'app/WhiteWrite.html').replace(/\\/g, '/');
  console.log('📄 Loading:', htmlPath, '\n');

  try {
    await page.goto(htmlPath, { waitUntil: 'networkidle' });

    // Wait for Firebase auth
    console.log('⏳ Waiting for Firebase auth...\n');
    await page.waitForTimeout(3000);

    // Check if user is logged in
    const isLoggedIn = await page.evaluate(() => {
      return window.__wwUser && window.__wwUser.uid;
    });

    if (!isLoggedIn) {
      console.log('❌ No user logged in. Please login first.');
      console.log('   Opening browser for manual login...\n');

      // Wait for manual login
      await page.waitForTimeout(30000);

      const isNowLoggedIn = await page.evaluate(() => {
        return window.__wwUser && window.__wwUser.uid;
      });

      if (!isNowLoggedIn) {
        console.log('❌ Still not logged in. Exiting.');
        await browser.close();
        return;
      }
    }

    console.log('✅ User logged in\n');

    // Get user info
    const user = await page.evaluate(() => {
      return {
        email: window.__wwUser?.email,
        plan: window.__wwUser?.plan,
        tokens: window.__wwUser?.tokensRemaining
      };
    });

    console.log('👤 User:', user, '\n');

    // Check if there's a project ID in URL
    const url = page.url();
    const hasProjectId = url.includes('projectId=');

    if (!hasProjectId) {
      console.log('❌ No projectId in URL. Please open a specific project.');
      console.log('   Waiting for manual navigation...\n');

      await page.waitForTimeout(60000);
    }

    // Wait for pagination to complete
    console.log('⏳ Waiting for pagination...\n');
    await page.waitForTimeout(5000);

    // Extract pagination results from page
    const results = await page.evaluate(() => {
      // This will be populated by our pagination logs
      return {
        completed: true,
        // We'll parse logs instead of extracting from page
      };
    });

    console.log('\n=== 📊 PAGINATION ANALYSIS ===\n');

    // Parse logs
    console.log('--- All Pagination Logs ---');
    logs.pagination.forEach(log => console.log(log));

    console.log('\n--- Errors ---');
    if (logs.errors.length === 0) {
      console.log('✅ No errors');
    } else {
      logs.errors.forEach(err => console.log('❌', err));
    }

    console.log('\n--- Warnings ---');
    if (logs.warnings.length === 0) {
      console.log('✅ No warnings');
    } else {
      logs.warnings.forEach(warn => console.log('⚠️', warn));
    }

    // Keep browser open for manual inspection
    console.log('\n✅ Test complete. Browser will stay open for inspection.');
    console.log('   Press Ctrl+C to close.\n');

    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testPagination().catch(console.error);
