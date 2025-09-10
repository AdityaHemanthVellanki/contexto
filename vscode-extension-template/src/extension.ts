import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Contexto MCP Client is now active!');

    async function getEndpoint(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('contexto');
        let endpoint = config.get<string>('endpoint');
        if (!endpoint || endpoint === 'PLACEHOLDER_MCP_URL') {
            vscode.window.showErrorMessage('Please configure your MCP endpoint in VS Code settings (contexto.endpoint)');
            return undefined;
        }
        if (!endpoint.startsWith('http')) {
            endpoint = `https://${endpoint}`;
        }
        if (endpoint.endsWith('/')) {
            endpoint = endpoint.slice(0, -1);
        }
        return endpoint;
    }

    async function openMarkdown(title: string, body: string) {
        const doc = await vscode.workspace.openTextDocument({
            content: `# ${title}\n\n${body}`,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }

    // Command: Ask MCP (freeform query)
    const askDisposable = vscode.commands.registerCommand('contexto.askMCP', async () => {
        try {
            const endpoint = await getEndpoint();
            if (!endpoint) return;

            const question = await vscode.window.showInputBox({
                prompt: 'What would you like to ask your MCP server?',
                placeHolder: 'Enter your question here...'
            });
            if (!question) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Querying MCP server...',
                cancellable: false
            }, async () => {
                const response = await fetch(`${endpoint}/query`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: question })
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                const textBlocks: string[] = Array.isArray(data?.content)
                    ? data.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text)
                    : [JSON.stringify(data, null, 2)];
                await openMarkdown('MCP Query Result', `**Question:** ${question}\n\n**Answer:**\n\n${textBlocks.join('\n\n')}`);
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Error: ${errorMessage}`);
        }
    });

    // Command: List available tools
    const listToolsDisposable = vscode.commands.registerCommand('contexto.listTools', async () => {
        const endpoint = await getEndpoint();
        if (!endpoint) return;
        try {
            const res = await fetch(`${endpoint}/tools`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const data = await res.json();
            const tools: any[] = data?.tools || [];
            if (!tools.length) return vscode.window.showInformationMessage('No tools available.');
            const items: vscode.QuickPickItem[] = tools.map((t: any) => ({ label: t.name, detail: t.description }));
            const pick = await vscode.window.showQuickPick<vscode.QuickPickItem>(items, { placeHolder: 'Available MCP tools' });
            if (!pick) return;
            await openMarkdown('MCP Tool', `Selected tool: ${pick.label}`);
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to list tools: ${e?.message || e}`);
        }
    });

    // Command: Call a tool
    const callToolDisposable = vscode.commands.registerCommand('contexto.callTool', async () => {
        const endpoint = await getEndpoint();
        if (!endpoint) return;
        try {
            // Fetch tools
            const res = await fetch(`${endpoint}/tools`);
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const data = await res.json();
            const tools: any[] = data?.tools || [];
            if (!tools.length) return vscode.window.showInformationMessage('No tools available.');

            // Pick tool
            const items: Array<vscode.QuickPickItem & { raw: any }> = tools.map((t: any) => ({ label: t.name as string, detail: t.description as string, raw: t }));
            const pick = await vscode.window.showQuickPick<vscode.QuickPickItem & { raw: any }>(items, { placeHolder: 'Select a tool to call' });
            if (!pick) return;

            // Gather args as JSON
            const argExample = JSON.stringify({ query: 'your query', limit: 5 }, null, 2);
            const argsInput = await vscode.window.showInputBox({
                prompt: `Provide JSON args for ${pick.label}. Example: ${argExample}`,
                value: '{}'
            });
            if (argsInput === undefined) return; // cancelled

            let parsedArgs: any = {};
            try {
                parsedArgs = argsInput.trim() ? JSON.parse(argsInput) : {};
            } catch (e) {
                vscode.window.showErrorMessage('Invalid JSON provided for args');
                return;
            }

            // Call tool
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Calling tool: ${pick.label}`,
                cancellable: false
            }, async () => {
                const resp = await fetch(`${endpoint}/call-tool`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: pick.label, args: parsedArgs })
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                const payload = await resp.json();
                const textBlocks: string[] = Array.isArray(payload?.content)
                    ? payload.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text)
                    : [JSON.stringify(payload, null, 2)];
                await openMarkdown(`MCP Tool Result: ${pick.label}`, textBlocks.join('\n\n'));
            });
        } catch (e: any) {
            vscode.window.showErrorMessage(`Failed to call tool: ${e?.message || e}`);
        }
    });

    context.subscriptions.push(askDisposable, listToolsDisposable, callToolDisposable);
}

export function deactivate() {}
