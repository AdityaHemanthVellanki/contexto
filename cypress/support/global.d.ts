/// <reference types="cypress" />
/// <reference types="mocha" />

// Add global type declarations for Cypress tests
declare global {
  // Ensure Cypress commands and assertions are globally available
  namespace Chai {
    interface ExpectStatic {}
  }
  const expect: any;
  
  // Make Cypress namespace accessible as a value
  const Cypress: any;
}

export {};
