import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMockTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const htmlPath = 'file:///' + path.resolve(__dirname, 'test-pagination-mock.html').replace(/\\/g, '/');

  console.log('📄 Loading mock test:', htmlPath);

  try {
    await page.goto(htmlPath, { waitUntil: 'networkidle' });

    // Wait for test to complete
    await page.waitForTimeout(5000);

    // Extract results
    const results = await page.evaluate(() => {
      const container = document.getElementById('results');
      return container ? container.innerText : 'No results';
    });

    console.log('\n=== 📊 TEST RESULTS ===\n');
    console.log(results);
    console.log('\n=== END ===\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

runMockTest();
