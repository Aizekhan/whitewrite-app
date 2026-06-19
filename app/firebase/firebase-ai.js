// Firebase Cloud Functions AI integration
// Client-side module for calling AI generation functions

window.__firebaseAI = {
  /**
   * Generate a scene based on project canon and scene intent
   *
   * @param {string} projectId - Project ID
   * @param {string} sceneIntent - 'conflict' | 'character' | 'action' | 'romance' | 'worldbuilding' | 'surprise' | 'custom'
   * @param {string} [customIntent] - Custom intent text (if sceneIntent === 'custom')
   * @param {Array} [previousScenes] - Previous scenes for continuity
   * @returns {Promise<{success: boolean, scene: {title: string, text: string, entities: Array}}>}
   */
  async generateScene(projectId, sceneIntent, customIntent = null, previousScenes = [], retryCount = 0, sceneId = null) {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 5000; // 5 seconds

    try {
      // Get auth token
      const user = firebase.auth().currentUser;
      if (!user) {
        throw new Error('Користувач не автентифікований');
      }

      const token = await user.getIdToken();

      // Generate sceneId if not provided (for canon linking)
      if (!sceneId) {
        sceneId = 'scene_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      }

      // Call HTTP endpoint directly with extended timeout
      console.log('Generating scene...', { projectId, sceneIntent, sceneId, attempt: retryCount + 1 });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes client timeout

      const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/generateScene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          sceneIntent,
          customIntent,
          previousScenes,
          sceneId  // Pass sceneId for canon linking
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('Scene generated:', result);
      return result;

    } catch (error) {
      console.error('generateScene error:', error);

      // Retry on timeout or network errors
      const isRetryable = error.name === 'AbortError' ||
                          error.message.includes('Failed to fetch') ||
                          error.message.includes('504') ||
                          error.message.includes('timeout');

      if (isRetryable && retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAY * (retryCount + 1);
        console.log(`Retrying in ${delay/1000}s... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.generateScene(projectId, sceneIntent, customIntent, previousScenes, retryCount + 1);
      }

      // User-friendly error messages
      let message = 'Помилка генерації сцени';

      if (error.code === 'unauthenticated') {
        message = 'Потрібна автентифікація';
      } else if (error.code === 'permission-denied') {
        message = 'Ви не є власником цього проєкту';
      } else if (error.code === 'not-found') {
        message = 'Проєкт не знайдено';
      } else if (error.message) {
        message = error.message;
      }

      return {
        success: false,
        error: message
      };
    }
  },

  /**
   * Scene Intent options for UI
   */
  sceneIntents: [
    { value: 'conflict', label: 'Конфлікт', icon: '⚔️', description: 'Протистояння, напруга, загострення' },
    { value: 'character', label: 'Розвиток персонажа', icon: '🎭', description: 'Внутрішні зміни, рішення, розкриття' },
    { value: 'action', label: 'Екшн', icon: '💥', description: 'Динаміка, рух, фізична дія' },
    { value: 'romance', label: 'Романтика', icon: '❤️', description: 'Емоційна близькість, зв\'язок' },
    { value: 'worldbuilding', label: 'Світобудова', icon: '🌍', description: 'Розкриття всесвіту, деталі світу' },
    { value: 'surprise', label: 'Сюрприз від AI', icon: '✨', description: 'Несподіваний поворот' },
    { value: 'custom', label: 'Свій напрям', icon: '✍️', description: 'Власний опис scene intent' }
  ]
};

// Helper: Test scene generation (for development)
window.__testGenerateScene = async function(projectId) {
  try {
    console.log('Testing scene generation for project:', projectId);

    const result = await window.__firebaseAI.generateScene(
      projectId,
      'surprise', // Random intent for testing
      null,
      [] // No previous scenes
    );

    if (result.success) {
      console.log('✅ Scene generated successfully!');
      console.log('Title:', result.scene.title);
      console.log('Text:', result.scene.text);
      console.log('Entities:', result.scene.entities);
      return result.scene;
    } else {
      console.error('❌ Scene generation failed:', result.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    return null;
  }
};

console.log('Firebase AI module loaded');
