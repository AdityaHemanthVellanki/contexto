/// <reference types="cypress" />
/// <reference types="node" />
/// <reference types="mocha" />

// Import from global.d.ts for TypeScript type checking
import '../support/global';

describe('Pipeline Production End-to-End Tests', () => {
  let authToken: string;
  let userId: string;
  let testPipelineId: string;

  // Simple test pipeline for e2e testing
  const testPipeline = {
    name: 'E2E Test Pipeline',
    description: 'Pipeline created for end-to-end testing',
    graph: {
      nodes: [
        {
          id: 'node1',
          type: 'dataSource',
          data: {
            type: 'dataSource',
            label: 'User Prompt',
            settings: {
              sourceType: 'prompt'
            }
          }
        },
        {
          id: 'node2',
          type: 'output',
          data: {
            type: 'output',
            label: 'Summary',
            settings: {
              outputFormat: 'summary'
            }
          }
        }
      ],
      edges: [
        {
          id: 'edge1',
          source: 'node1',
          target: 'node2'
        }
      ]
    }
  };

  before(() => {
    // Load Firebase from the window object (provided by the app)
    // and sign in with test credentials
    cy.visit('/');
    
    cy.window().then((win: any) => {
      // This assumes you have a test user set up in your Firebase project
      // Do not use the test credentials in production
      const email = Cypress.env('TEST_USER_EMAIL') as string;
      const password = Cypress.env('TEST_USER_PASSWORD') as string;
      
      return win.firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential: any) => {
          userId = userCredential.user.uid;
          return userCredential.user.getIdToken();
        }).then((token: string) => {
          authToken = token;
        });
    });
  });

  after(() => {
    // Clean up - delete the test pipeline if it was created
    if (testPipelineId) {
      cy.request({
        method: 'DELETE',
        url: `/api/pipelines?id=${testPipelineId}`,
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    }
    
    // Sign out
    cy.window().then((win: any) => {
      win.firebase.auth().signOut();
    });
  });

  it('Should create a new pipeline', () => {
    // Create a new pipeline using the API
    cy.request({
      method: 'POST',
      url: '/api/pipelines',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: testPipeline
    }).then((response: any) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property('id');
      testPipelineId = response.body.id;
      
      // Verify pipeline was created correctly
      expect(response.body.name).to.eq(testPipeline.name);
      expect(response.body.description).to.eq(testPipeline.description);
      expect(response.body.graph.nodes).to.have.length(2);
      expect(response.body.graph.edges).to.have.length(1);
    });
  });

  it('Should fetch existing pipelines', () => {
    // Fetch all pipelines for the authenticated user
    cy.request({
      method: 'GET',
      url: '/api/pipelines',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }).then((response: any) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an('array');
      
      // Verify our test pipeline is in the list
      const foundPipeline = response.body.find((p: any) => p.id === testPipelineId);
      expect(foundPipeline).to.exist;
      expect(foundPipeline.name).to.eq(testPipeline.name);
    });
  });

  it('Should execute a pipeline with real Azure OpenAI API', () => {
    // Only run this test if we have the required env vars
    // Get the env variable value safely
    let runOpenAiTests = false;
    try {
      runOpenAiTests = Boolean(Cypress.env('RUN_OPENAI_TESTS'));
    } catch (e) {
      // Fallback if env var cannot be accessed
      runOpenAiTests = false;
    }
    
    if (!runOpenAiTests) {
      cy.log('Skipping OpenAI API test - RUN_OPENAI_TESTS flag not set');
      return;
    }
    
    // Execute the pipeline
    cy.request({
      method: 'POST',
      url: '/api/runPipeline',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        pipelineId: testPipelineId,
        graph: testPipeline.graph,
        prompt: 'Summarize the key features of modern AI systems.'
      },
      timeout: 30000 // Allow up to 30 seconds for API call
    }).then((response: any) => {
      expect(response.status).to.eq(200);
      
      // Verify the response contains results
      expect(response.body).to.have.property('result');
      expect(response.body.result).to.be.an('array');
      expect(response.body.result[0]).to.have.property('nodeId', 'node2');
      
      // Verify usage reporting is working
      expect(response.body).to.have.property('usageReport');
      expect(response.body.usageReport).to.have.property('total');
      expect(response.body.usageReport.total).to.have.property('promptTokens');
      expect(response.body.usageReport.total).to.have.property('completionTokens');
    });
  });

  it('Should update an existing pipeline', () => {
    // Update the test pipeline
    const updatedPipeline = {
      ...testPipeline,
      name: 'Updated E2E Test Pipeline',
      description: 'This pipeline was updated during E2E testing'
    };
    
    cy.request({
      method: 'PUT',
      url: '/api/pipelines',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        id: testPipelineId,
        ...updatedPipeline
      }
    }).then((response: any) => {
      expect(response.status).to.eq(200);
      expect(response.body.name).to.eq(updatedPipeline.name);
      expect(response.body.description).to.eq(updatedPipeline.description);
    });
  });

  it('Should reject pipeline execution without authentication', () => {
    // Try to run a pipeline without auth token
    cy.request({
      method: 'POST',
      url: '/api/runPipeline',
      failOnStatusCode: false,
      body: {
        graph: testPipeline.graph,
        prompt: 'This should fail'
      }
    }).then((response: any) => {
      expect(response.status).to.eq(401);
      expect(response.body).to.have.property('error');
      expect(response.body.error).to.include('Authentication required');
    });
  });
});
