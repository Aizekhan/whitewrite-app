// ============================================================================
// WhiteWrite Canon Extraction — Full Test Suite
// ============================================================================
// Copy-paste this into Chrome DevTools Console on https://whitewrite-app.web.app
// Make sure you're logged in as hrytsenkomaksym@gmail.com (worldforge plan)
// ============================================================================

async function testAutoExtraction() {
  const projectId = window.__currentProjectId || 'proj_1781503252436_e7s6ce1wt'; // Попіл життя
  const idToken = await firebase.auth().currentUser.getIdToken();

  console.log('🧪 Test 1: Auto-Extraction');
  console.log('Project:', projectId);
  console.log('User:', firebase.auth().currentUser.email);
  console.log('Plan:', window.__wwUser?.plan);
  console.log('Tokens before:', window.__wwUser?.tokensRemaining);
  console.log('---');

  // Generate scene
  const response = await fetch('https://generatescene-3cphx6huhq-uc.a.run.app', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      projectId,
      sceneIntent: 'conflict',
      previousScenes: [],
      uid: firebase.auth().currentUser.uid
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Scene generated successfully!');
    console.log('Title:', result.scene?.title);
    console.log('Length:', result.scene?.text?.length, 'chars');
    console.log('Tokens consumed:', result.tokensConsumed);
    console.log('Tokens remaining:', result.tokensRemaining);
    console.log('---');
    console.log('Scene text preview:');
    console.log(result.scene?.text?.substring(0, 200) + '...');
    console.log('---');
    console.log('⏳ Auto-extraction running in background...');
    console.log('Wait 10-15 seconds, then check Firestore:');
    console.log(`https://console.firebase.google.com/project/whitewrite-app/firestore/data/~2Fprojects~2F${projectId}`);
    return result;
  } else {
    console.error('❌ Scene generation failed:', result.error);
    throw new Error(result.error);
  }
}

async function testAnalyze() {
  const projectId = window.__currentProjectId || 'proj_1781503252436_e7s6ce1wt';
  const idToken = await firebase.auth().currentUser.getIdToken();

  const sceneText = `## Зустріч у таверні

Маркус увійшов до задимленої таверни, намацуючи рукоять меча під плащем. Його очі звикали до півтемряви. Біля каміна сиділа жінка у чорному — та сама, що обіцяла інформацію про артефакт.

— Ти запізнився, — кинула вона, не піднімаючи погляду від келиха.

— Мене затримала варта. Ти маєш карту?

Вона усміхнулась — холодно, без радості.

— Карта у мене. Але ціна змінилась. Тепер я хочу половину артефакту, коли ти його знайдеш.

Маркус стиснув кулаки. Угода руйнувалась прямо на очах.`;

  console.log('🧪 Test 2: ANALYZE Mode');
  console.log('Scene length:', sceneText.length, 'chars');
  console.log('Tokens before:', window.__wwUser?.tokensRemaining);
  console.log('---');

  const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/analyzeScene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      projectId,
      sceneText,
      uid: firebase.auth().currentUser.uid
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ Analysis complete!');
    console.log('---');
    console.log('📊 SCORES:');
    console.log('Overall Score:', result.analysis.score, '/10');
    console.log('Detailed Scores:');
    console.log('  - Plot:', result.analysis.detailedScores?.plot, '/10');
    console.log('  - Characters:', result.analysis.detailedScores?.characters, '/10');
    console.log('  - Conflict:', result.analysis.detailedScores?.conflict, '/10');
    console.log('  - Atmosphere:', result.analysis.detailedScores?.atmosphere, '/10');
    console.log('  - Dialogue:', result.analysis.detailedScores?.dialogue, '/10');
    console.log('  - Style:', result.analysis.detailedScores?.style, '/10');
    console.log('---');
    console.log('💪 STRENGTHS:', result.analysis.strengths);
    console.log('⚠️  WEAKNESSES:', result.analysis.weaknesses);
    console.log('💡 SUGGESTIONS:', result.analysis.suggestions);
    console.log('---');
    console.log('🔍 DIAGNOSTICS:');
    console.log('Consistency Issues:', result.analysis.consistencyIssues?.length || 0);
    if (result.analysis.consistencyIssues?.length > 0) {
      console.log('Issues:', result.analysis.consistencyIssues);
    }
    console.log('Tension Segments:', result.analysis.tensionAnalysis?.length || 0);
    if (result.analysis.tensionAnalysis?.length > 0) {
      console.log('Tension breakdown:', result.analysis.tensionAnalysis);
    }
    console.log('Quick Fixes:', result.analysis.quickFixes?.length || 0);
    if (result.analysis.quickFixes?.length > 0) {
      console.log('Fixes:', result.analysis.quickFixes);
    }
    console.log('---');
    console.log('Tokens consumed:', result.tokensConsumed);
    console.log('Tokens remaining:', result.tokensRemaining);
    return result;
  } else {
    console.error('❌ Analysis failed:', result.error);
    throw new Error(result.error);
  }
}

function testPlanGates() {
  console.log('🧪 Test 3: Plan Gates');
  console.log('Current plan:', window.__wwUser?.plan);
  console.log('---');

  // Check plan config
  const planConfig = window.__getPlanConfig(window.__wwUser?.plan);
  console.log('📋 Plan Config:');
  console.log('- allowWorldTree:', planConfig.allowWorldTree ? '✅' : '❌');
  console.log('- allowCanonExtraction:', planConfig.allowCanonExtraction ? '✅' : '❌');
  console.log('- allowCanonSync:', planConfig.allowCanonSync ? '✅' : '❌');
  console.log('- allowAnalyze:', planConfig.allowAnalyze ? '✅' : '❌');
  console.log('- allowImprove:', planConfig.allowImprove ? '✅' : '❌');
  console.log('---');

  // Simulate different plans
  console.log('🔒 Plan Comparison:');
  ['free', 'storyteller', 'novelist', 'worldbuilder'].forEach(plan => {
    const config = window.__getPlanConfig(plan);
    console.log(`\n${plan.toUpperCase()}:`);
    console.log('  WorldTree:', config.allowWorldTree ? '✅' : '❌');
    console.log('  Extraction:', config.allowCanonExtraction ? '✅' : '❌');
    console.log('  ANALYZE:', config.allowAnalyze ? '✅' : '❌');
  });

  console.log('\n---');
  console.log('Current user should have ALL features (worldforge plan)');
}

async function checkFirestore() {
  console.log('🧪 Test 4: Firestore Verification');
  const projectId = window.__currentProjectId || 'proj_1781503252436_e7s6ce1wt';

  try {
    const projectDoc = await firebase.firestore().collection('projects').doc(projectId).get();
    const data = projectDoc.data();

    console.log('---');
    console.log('📦 Project Data:');
    console.log('Title:', data?.title);
    console.log('Owner:', data?.owner);
    console.log('Scenes count:', data?.scenes?.length || 0);
    console.log('---');

    console.log('🌳 Canon:');
    const canon = data?.canon || {};
    console.log('Characters:', Object.keys(canon.characters || {}).length);
    console.log('Locations:', Object.keys(canon.locations || {}).length);
    console.log('Events:', Object.keys(canon.events || {}).length);
    console.log('Factions:', Object.keys(canon.factions || {}).length);
    console.log('Artifacts:', Object.keys(canon.artifacts || {}).length);

    if (Object.keys(canon.characters || {}).length > 0) {
      console.log('\nCharacters:');
      Object.entries(canon.characters).slice(0, 3).forEach(([id, char]) => {
        console.log(`  - ${char.name} (${char.role || 'no role'})`);
      });
    }
    console.log('---');

    console.log('📋 Inferred Canon:');
    const inferredCanon = data?.inferredCanon || {};
    const inferredKeys = Object.keys(inferredCanon);
    console.log('Total scenes:', inferredKeys.length);

    const pending = inferredKeys.filter(key => inferredCanon[key].status === 'pending');
    const approved = inferredKeys.filter(key => inferredCanon[key].status === 'approved');
    const rejected = inferredKeys.filter(key => inferredCanon[key].status === 'rejected');

    console.log('  - Pending:', pending.length);
    console.log('  - Approved:', approved.length);
    console.log('  - Rejected:', rejected.length);

    if (pending.length > 0) {
      console.log('\nLatest pending suggestions:');
      const latestKey = pending[pending.length - 1];
      const suggestions = inferredCanon[latestKey]?.suggestions || [];
      console.log('Scene:', latestKey);
      console.log('Suggestions count:', suggestions.length);
      suggestions.slice(0, 3).forEach(s => {
        console.log(`  - [${s.type}] ${s.newData?.name || s.targetId}: ${s.reason}`);
      });
    }

    console.log('---');
    console.log('✅ Firestore verification complete');
    console.log(`\nOpen in console: https://console.firebase.google.com/project/whitewrite-app/firestore/data/~2Fprojects~2F${projectId}`);

  } catch (error) {
    console.error('❌ Firestore check failed:', error);
  }
}

async function testReviewQueue() {
  console.log('🧪 Test 5: Review Queue UI');
  console.log('---');
  console.log('Manual steps:');
  console.log('1. Open WorldTree: https://whitewrite-app.web.app/WhiteWrite%20WorldTree.html');
  console.log('2. Click Chronicle (scroll icon)');
  console.log('3. Look for "Нові сутності на розгляді" section');
  console.log('4. Click "Прийняти" on any suggestion');
  console.log('5. Reload page');
  console.log('6. Verify entity moved to canon (check Firestore)');
  console.log('---');
  console.log('⏭️  Skipping (manual test)');
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   WhiteWrite Canon Extraction — Full Test Suite           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('User:', firebase.auth().currentUser?.email || 'NOT LOGGED IN');
  console.log('Plan:', window.__wwUser?.plan || 'UNKNOWN');
  console.log('Tokens:', window.__wwUser?.tokensRemaining || 0);
  console.log('Project:', window.__currentProjectId || 'NONE');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Test 1: Auto-Extraction
    await testAutoExtraction();
    console.log('\n⏳ Waiting 20 seconds for background extraction...\n');
    await new Promise(r => setTimeout(r, 20000));

    // Test 2: ANALYZE
    console.log('═══════════════════════════════════════════════════════════\n');
    await testAnalyze();

    // Test 3: Plan Gates
    console.log('\n═══════════════════════════════════════════════════════════\n');
    testPlanGates();

    // Test 4: Firestore
    console.log('\n═══════════════════════════════════════════════════════════\n');
    await checkFirestore();

    // Test 5: Review Queue
    console.log('\n═══════════════════════════════════════════════════════════\n');
    testReviewQueue();

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ ALL TESTS COMPLETE!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check Firestore Console for inferredCanon');
    console.log('2. Open WorldTree → Chronicle → Review Queue');
    console.log('3. Test Approval flow (click "Прийняти")');
    console.log('4. Verify canon updated in Firestore');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error);
    console.error('Stack:', error.stack);
  }
}

// Auto-run on paste
console.log('Test suite loaded! Run: runAllTests()');
console.log('Or run individual tests:');
console.log('  - testAutoExtraction()');
console.log('  - testAnalyze()');
console.log('  - testPlanGates()');
console.log('  - checkFirestore()');
