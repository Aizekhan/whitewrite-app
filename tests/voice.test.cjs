// Voice-over price (functions/paid-features.js ttsCost — the client's "≈ N" and the server's reservation are the same number).
// Run: npm test
const { ttsClass, ttsCost, ttsUsd, featureCost, byOp, TTS, USD_PER_TOKEN } = require('../functions/paid-features.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got "${got}", want "${want}")`)); if (!ok) fails++; };

check(ttsClass('uk-UA-Standard-A'), 'standard', 'Standard voice class');
check(ttsClass('en-US-Wavenet-D'), 'wavenet', 'WaveNet voice class');
check(ttsClass('en-US-Chirp3-HD-Aoede'), 'chirp', 'Chirp 3 HD voice class');
check(ttsClass('en-US-Studio-O'), 'studio', 'Studio voice class');
check(ttsClass(''), 'standard', 'the default voice is priced as Standard');
check(ttsCost(0, 'en-US-Wavenet-D'), 0, 'no text — no charge');
check(ttsCost(1, 'uk-UA-Standard-A'), 1, 'one character costs at least one token');
check(ttsCost(1000, 'en-US-Studio-O') > ttsCost(1000, 'en-US-Wavenet-D') && ttsCost(1000, 'en-US-Wavenet-D') > ttsCost(1000, 'uk-UA-Standard-A'), true, 'dearer voice classes cost more');
check(ttsCost(1000, 'en-US-Wavenet-D') * USD_PER_TOKEN >= ttsUsd(1000, 'en-US-Wavenet-D') * TTS.margin - USD_PER_TOKEN, true, 'the charge covers the API cost × margin');
check(featureCost(byOp('voiceTts'), 0), ttsCost(1000, 'wavenet'), 'the registry price = 1000 WaveNet characters');
check(byOp('voiceTts').flag, 'allowGameDev', 'Google voice-over is Worldbuilder');

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nALL PASSED');
