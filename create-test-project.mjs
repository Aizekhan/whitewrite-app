// Create test project via Firestore REST API
// Run: node create-test-project.mjs

const projectId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

const projectData = {
  fields: {
    owner: { stringValue: 'demo_user' },
    title: { stringValue: 'Червоний сигнал' },
    desc: { stringValue: 'Колонії Марса вмовкли. Тиша поширюється швидше за світло — і ще один сигнал кличе крізь неї.' },
    meta: { stringValue: 'Hard SF · Сезон' },
    scope: { stringValue: 'season' },
    ending: { stringValue: 'open' },
    genres: {
      arrayValue: {
        values: [
          { stringValue: 'Hard SF' },
          { stringValue: 'Космоопера' }
        ]
      }
    },
    written: { integerValue: '9' },
    active: { booleanValue: true },
    badge: { stringValue: 'active' },
    c1: { stringValue: '#c2542a' },
    c2: { stringValue: '#2a1c16' },
    canonAware: { booleanValue: true },
    canon: {
      mapValue: {
        fields: {
          characters: { mapValue: {} },
          locations: { mapValue: {} },
          events: { mapValue: {} },
          factions: { mapValue: {} },
          artifacts: { mapValue: {} },
          world: { mapValue: {} }
        }
      }
    }
  }
};

const url = `https://firestore.googleapis.com/v1/projects/whitewrite-app/databases/(default)/documents/projects?documentId=${projectId}`;

console.log('Creating project:', projectId);

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8'
  },
  body: JSON.stringify(projectData)
});

const result = await response.json();

if (response.ok) {
  console.log('✅ Test project created successfully!');
  console.log('Project ID:', projectId);
  console.log('Title:', result.fields.title.stringValue);
  console.log('\n🔄 Refresh http://localhost:5177/White.html to see it');
} else {
  console.error('❌ Failed to create project:', result);
}
