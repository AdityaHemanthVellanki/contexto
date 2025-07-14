/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Custom command to select DOM element by data-cy attribute.
     * @example cy.dataCy('greeting')
     */
    dataCy(value: string): Chainable<Element>;

    /**
     * Get environment variable with type safety
     * @example cy.env('TEST_USER_EMAIL')
     */
    env(key: string): Chainable<string>;
  }
}
