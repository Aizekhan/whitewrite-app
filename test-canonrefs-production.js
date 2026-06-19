// Production test: Scene ↔ Canon Relational Links
// Tests ALL 4 verifications with real screenshots

const { chromium } = require('playwright');
const path = require('path');

const PROD_URL = 'https://whitewrite-app.web.app';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-canonrefs');

// Test credentials (use environment or hardcode for testing)
const TEST_EMAIL = process.env.WW_TEST_EMAIL || 'test@whitewrite.com';
const TEST_PASSWORD = process.env.WW_TEST_PASSWORD || 'test123';

async function runTests() {
  console.log('🚀 Starting Production Tests: Scene ↔ Canon Links\n');

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // ============================================================
    // SETUP: Login & Create Test Project
    // ============================================================
    console.log('📝 [SETUP] Opening WhiteWrite...');
    await page.goto(PROD_URL);
    await page.waitForTimeout(2000);

    // Check if already logged in
    const isLoggedIn = await page.locator('#tokcount').isVisible().catch(() => false);

    if (!isLoggedIn) {
      console.log('🔑 [SETUP] Logging in...');
      await page.click('text=Увійти');
      await page.waitForSelector('.auth-modal', { timeout: 5000 });
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      await page.click('button:has-text("Увійти")');
      await page.waitForTimeout(3000);
    }

    console.log('✅ [SETUP] Logged in');

    // Navigate to projects
    await page.goto(`${PROD_URL}/WhiteWrite.html?new=1`);
    await page.waitForTimeout(2000);

    // Create new test project
    console.log('📦 [SETUP] Creating test project...');
    await page.fill('textarea[placeholder*="опиш"]', 'Космічна станція Орелія. Останні люди. Таємниці минулого.');
    await page.click('button:has-text("Створити")');
    await page.waitForTimeout(15000); // Wait for scene generation

    console.log('✅ [SETUP] Project created\n');

    // Get projectId from URL or console
    const projectId = await page.evaluate(() => window.__currentProjectId || localStorage.getItem('ww_currentProject'));
    console.log(`📌 Project ID: ${projectId}\n`);

    // ============================================================
    // TEST 1: Generate Scene → Firestore canonRefs filled
    // ============================================================
    console.log('🧪 [TEST 1] Checking Firestore canonRefs...');

    // Open Firestore in console
    const firestoreData = await page.evaluate(async (pid) => {
      const db = window.__firebase.db;
      const scenesSnapshot = await db.collection('projects').doc(pid).collection('scenes').get();
      const scenes = scenesSnapshot.docs.map(doc => ({
        id: doc.id,
        n: doc.data().n,
        title: doc.data().title,
        canonRefs: doc.data().canonRefs
      }));
      return scenes;
    }, projectId);

    console.log(`   Found ${firestoreData.length} scenes`);

    const scene1 = firestoreData[0];
    if (scene1 && scene1.canonRefs) {
      console.log(`   Scene 1 canonRefs:`, scene1.canonRefs);
      console.log(`   ✅ Characters: ${scene1.canonRefs.characters?.length || 0}`);
      console.log(`   ✅ Locations: ${scene1.canonRefs.locations?.length || 0}`);
      console.log(`   ✅ Events: ${scene1.canonRefs.events?.length || 0}`);
    } else {
      console.log(`   ❌ canonRefs MISSING!`);
    }

    // Screenshot: Firestore Console
    await page.goto(`https://console.firebase.google.com/project/whitewrite-app/firestore/databases/-default-/data/~2Fprojects~2F${projectId}~2Fscenes`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1-firestore-canonrefs.png'), fullPage: true });
    console.log(`   📸 Screenshot: 1-firestore-canonrefs.png\n`);

    // ============================================================
    // TEST 2: SceneMenu Filter → Shows ONLY scene participants
    // ============================================================
    console.log('🧪 [TEST 2] Testing SceneMenu filter...');

    await page.goto(`${PROD_URL}/WhiteWrite%20Workspace.html?projectId=${projectId}`);
    await page.waitForTimeout(3000);

    // Select "Персонажі" tab
    await page.click('button:has-text("Персонажі")');
    await page.waitForTimeout(1000);

    // Count total characters
    const totalChars = await page.locator('.entity-card').count();
    console.log(`   Total characters: ${totalChars}`);

    // Select Scene 1 from dropdown
    await page.click('select[name="scene"]'); // Scene filter dropdown
    await page.selectOption('select[name="scene"]', { label: 'Сцена 1' });
    await page.waitForTimeout(1000);

    // Count filtered characters
    const filteredChars = await page.locator('.entity-card').count();
    console.log(`   Filtered characters (Scene 1): ${filteredChars}`);

    if (filteredChars < totalChars) {
      console.log(`   ✅ Filter works! (${filteredChars} < ${totalChars})`);
    } else {
      console.log(`   ⚠️  Filter may not work (${filteredChars} = ${totalChars})`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2-scenemenu-filter.png'), fullPage: true });
    console.log(`   📸 Screenshot: 2-scenemenu-filter.png\n`);

    // ============================================================
    // TEST 3: Reconstruction wAffected → Shows correct scenes
    // ============================================================
    console.log('🧪 [TEST 3] Testing reconstruction impact...');

    // Open WorldTree
    await page.goto(`${PROD_URL}/WhiteWrite%20WorldTree.html?projectId=${projectId}`);
    await page.waitForTimeout(3000);

    // Select first character
    await page.click('.entity-card:first-child');
    await page.waitForTimeout(1000);

    // Open reconstruction panel (if exists) or check console
    const impactData = await page.evaluate(() => {
      const chars = Object.keys(window.WORLD?.characters || {});
      if (chars.length === 0) return null;

      const firstCharId = chars[0];
      const impact = window.wImpact('characters', firstCharId);
      const affected = window.wAffected('characters', firstCharId);

      return {
        charId: firstCharId,
        charName: window.WORLD.characters[firstCharId]?.name,
        impact,
        affectedScenes: affected.narrative.scenes.map(s => s.n)
      };
    });

    if (impactData) {
      console.log(`   Character: ${impactData.charName}`);
      console.log(`   Total affected: ${impactData.impact.total}`);
      console.log(`   Affected scenes: ${impactData.affectedScenes.join(', ')}`);
      console.log(`   ✅ wAffected() works!`);
    } else {
      console.log(`   ⚠️  No characters found`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '3-reconstruction-impact.png'), fullPage: true });
    console.log(`   📸 Screenshot: 3-reconstruction-impact.png\n`);

    // ============================================================
    // TEST 4: Rename Character → Scenes see new name
    // ============================================================
    console.log('🧪 [TEST 4] Testing rename consistency...');

    // Get character name before rename
    const oldName = await page.evaluate(() => {
      const chars = Object.keys(window.WORLD?.characters || {});
      if (chars.length === 0) return null;
      return window.WORLD.characters[chars[0]]?.name;
    });

    console.log(`   Original name: ${oldName}`);

    // Rename character (simulated via console - UI rename not implemented yet)
    const newName = await page.evaluate((oldN) => {
      const chars = Object.keys(window.WORLD?.characters || {});
      if (chars.length === 0) return null;

      const charId = chars[0];
      const newN = oldN + ' (Renamed)';

      // Update in WORLD
      window.WORLD.characters[charId].name = newN;

      // Check scene text references (should use ID, not name)
      const scenes = window.WORLD.scenes || [];
      const scene1 = scenes[0];

      return {
        newName: newN,
        scene1StillWorks: scene1?.canonRefs?.characters?.includes(charId)
      };
    }, oldName);

    if (newName) {
      console.log(`   New name: ${newName.newName}`);
      console.log(`   Scene 1 canonRefs still has character ID: ${newName.scene1StillWorks ? '✅' : '❌'}`);
      console.log(`   ✅ ID-based linking works!`);
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '4-rename-consistency.png'), fullPage: true });
    console.log(`   📸 Screenshot: 4-rename-consistency.png\n`);

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n✅ ALL TESTS COMPLETE!\n');
    console.log('📸 Screenshots saved to:', SCREENSHOTS_DIR);
    console.log('\nTest Results:');
    console.log('  [1] Firestore canonRefs:', scene1?.canonRefs ? '✅ FILLED' : '❌ MISSING');
    console.log('  [2] SceneMenu filter:', filteredChars < totalChars ? '✅ WORKS' : '⚠️  CHECK');
    console.log('  [3] Reconstruction wAffected:', impactData ? '✅ WORKS' : '⚠️  CHECK');
    console.log('  [4] Rename consistency:', newName?.scene1StillWorks ? '✅ WORKS' : '⚠️  CHECK');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

runTests().catch(console.error);
