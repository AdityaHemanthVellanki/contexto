"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function activate(context) {
    console.log('Contexto MCP Client is now active!');
    const disposable = vscode.commands.registerCommand('contexto.askMCP', async () => {
        try {
            // Get MCP endpoint from configuration
            const config = vscode.workspace.getConfiguration('contexto');
            let endpoint = config.get('endpoint');
            if (!endpoint || endpoint === 'PLACEHOLDER_MCP_URL') {
                vscode.window.showErrorMessage('Please configure your MCP endpoint in VS Code settings (contexto.endpoint)');
                return;
            }
            // Ensure endpoint ends with proper format
            if (!endpoint.startsWith('http')) {
                endpoint = `https://${endpoint}`;
            }
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.slice(0, -1);
            }
            // Prompt user for question
            const question = await vscode.window.showInputBox({
                prompt: 'What would you like to ask your MCP server?',
                placeHolder: 'Enter your question here...'
            });
            if (!question) {
                return; // User cancelled
            }
            // Show progress
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Querying MCP server...',
                cancellable: false
            }, async (progress) => {
                try {
                    // Make request to MCP server
                    const response = await fetch(`${endpoint}/query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ question })
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    const data = await response.json();
                    const answer = data.answer || 'No answer received';
                    // Create new document with the answer
                    const doc = await vscode.workspace.openTextDocument({
                        content: `# MCP Query Result\n\n**Question:** ${question}\n\n**Answer:**\n\n${answer}`,
                        language: 'markdown'
                    });
                    // Show the document
                    await vscode.window.showTextDocument(doc);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    vscode.window.showErrorMessage(`Failed to query MCP server: ${errorMessage}`);
                }
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Error: ${errorMessage}`);
        }
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map