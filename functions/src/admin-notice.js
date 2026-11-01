// Admin notices: admin_notices/{id} (admins see a banner in the Account) + a Markdown file admin/notices/… in Storage
const { admin, db } = require('./common');

async function notify(n) {
  const at = new Date();
  const doc = Object.assign({ kind: 'ai-model', resolved: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }, n);
  const ref = await db.collection('admin_notices').add(doc);
  const md = `# ${n.severity === 'critical' ? '⚠ КРИТИЧНО: ' : ''}${n.title}\n\n${at.toISOString()} · tier: ${n.tier || '—'}\n\n${n.body}\n`;
  try {
    await admin.storage().bucket().file(`admin/notices/${at.toISOString().slice(0, 10)}-${n.tier || 'models'}-${ref.id}.md`)
      .save(md, { contentType: 'text/markdown; charset=utf-8' });
  } catch (e) { console.warn('[notice] file:', e.message); }
  console.log(`[notice] (${n.severity}): ${n.title}`);
}

module.exports = { notify };
