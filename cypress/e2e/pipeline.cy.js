"use strict";
/// <reference types="cypress" />
/// <reference types="node" />
/// <reference types="mocha" />
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import from global.d.ts for TypeScript type checking
require("../support/global");
describe('Pipeline Production End-to-End Tests', function () {
    var authToken;
    var userId;
    var testPipelineId;
    // Simple test pipeline for e2e testing
    var testPipeline = {
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
    before(function () {
        // Load Firebase from the window object (provided by the app)
        // and sign in with test credentials
        cy.visit('/');
        cy.window().then(function (win) {
            // This assumes you have a test user set up in your Firebase project
            // Do not use the test credentials in production
            var email = Cypress.env('TEST_USER_EMAIL');
            var password = Cypress.env('TEST_USER_PASSWORD');
            return win.firebase.auth().signInWithEmailAndPassword(email, password)
                .then(function (userCredential) {
                userId = userCredential.user.uid;
                return userCredential.user.getIdToken();
            }).then(function (token) {
                authToken = token;
            });
        });
    });
    after(function () {
        // Clean up - delete the test pipeline if it was created
        if (testPipelineId) {
            cy.request({
                method: 'DELETE',
                url: "/api/pipelines?id=".concat(testPipelineId),
                headers: {
                    'Authorization': "Bearer ".concat(authToken)
                }
            });
        }
        // Sign out
        cy.window().then(function (win) {
            win.firebase.auth().signOut();
        });
    });
    it('Should create a new pipeline', function () {
        // Create a new pipeline using the API
        cy.request({
            method: 'POST',
            url: '/api/pipelines',
            headers: {
                'Authorization': "Bearer ".concat(authToken)
            },
            body: testPipeline
        }).then(function (response) {
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
    it('Should fetch existing pipelines', function () {
        // Fetch all pipelines for the authenticated user
        cy.request({
            method: 'GET',
            url: '/api/pipelines',
            headers: {
                'Authorization': "Bearer ".concat(authToken)
            }
        }).then(function (response) {
            expect(response.status).to.eq(200);
            expect(response.body).to.be.an('array');
            // Verify our test pipeline is in the list
            var foundPipeline = response.body.find(function (p) { return p.id === testPipelineId; });
            expect(foundPipeline).to.exist;
            expect(foundPipeline.name).to.eq(testPipeline.name);
        });
    });
    it('Should execute a pipeline with real Azure OpenAI API', function () {
        // Only run this test if we have the required env vars
        // Get the env variable value safely
        var runOpenAiTests = false;
        try {
            runOpenAiTests = Boolean(Cypress.env('RUN_OPENAI_TESTS'));
        }
        catch (e) {
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
                'Authorization': "Bearer ".concat(authToken)
            },
            body: {
                pipelineId: testPipelineId,
                graph: testPipeline.graph,
                prompt: 'Summarize the key features of modern AI systems.'
            },
            timeout: 30000 // Allow up to 30 seconds for API call
        }).then(function (response) {
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
    it('Should update an existing pipeline', function () {
        // Update the test pipeline
        var updatedPipeline = __assign(__assign({}, testPipeline), { name: 'Updated E2E Test Pipeline', description: 'This pipeline was updated during E2E testing' });
        cy.request({
            method: 'PUT',
            url: '/api/pipelines',
            headers: {
                'Authorization': "Bearer ".concat(authToken)
            },
            body: __assign({ id: testPipelineId }, updatedPipeline)
        }).then(function (response) {
            expect(response.status).to.eq(200);
            expect(response.body.name).to.eq(updatedPipeline.name);
            expect(response.body.description).to.eq(updatedPipeline.description);
        });
    });
    it('Should reject pipeline execution without authentication', function () {
        // Try to run a pipeline without auth token
        cy.request({
            method: 'POST',
            url: '/api/runPipeline',
            failOnStatusCode: false,
            body: {
                graph: testPipeline.graph,
                prompt: 'This should fail'
            }
        }).then(function (response) {
            expect(response.status).to.eq(401);
            expect(response.body).to.have.property('error');
            expect(response.body.error).to.include('Authentication required');
        });
    });
});
