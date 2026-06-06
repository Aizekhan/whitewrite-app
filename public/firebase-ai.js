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
  async generateScene(projectId, sceneIntent, customIntent = null, previousScenes = []) {
    try {
      // Get callable function
      const functions = window.__firebase.functions || firebase.functions();
      const generateSceneFunc = functions.httpsCallable('generateScene');

      // Call function
      console.log('Generating scene...', { projectId, sceneIntent });
      const result = await generateSceneFunc({
        projectId,
        sceneIntent,
        customIntent,
        previousScenes
      });

      console.log('Scene generated:', result.data);
      return result.data;

    } catch (error) {
      console.error('generateScene error:', error);

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
