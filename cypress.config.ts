import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
  },
  env: {
    // Environment variables for Cypress tests
    TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || 'test@example.com',
    TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || 'testpassword',
    RUN_OPENAI_TESTS: process.env.RUN_OPENAI_TESTS === 'true'
  }
});
