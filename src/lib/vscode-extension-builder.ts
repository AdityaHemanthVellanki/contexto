import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import * as ts from 'typescript';
import { generateUploadUrl, generateDownloadUrl } from '@/lib/r2-client';

export interface BuildVSIXOptions {
  userId: string;
  pipelineId: string;
  endpoint: string;
  appName?: string;
}

function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
}

async function loadTemplateVsix(): Promise<JSZip> {
  const vsixPath = path.join(process.cwd(), 'vscode-extension-template', 'test.vsix');
  const buf = await fs.promises.readFile(vsixPath);
  const zip = await JSZip.loadAsync(buf);
  return zip;
}

function findFirstKeyEnding(zip: JSZip, suffix: string): string | null {
  const keys = Object.keys(zip.files);
  for (const k of keys) {
    if (k.toLowerCase().endsWith(suffix.toLowerCase())) return k;
  }
  return null;
}

function compileExtensionTs(): string | null {
  try {
    const srcPath = path.join(process.cwd(), 'vscode-extension-template', 'src', 'extension.ts');
    const source = fs.readFileSync(srcPath, 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2019,
        esModuleInterop: true,
        skipLibCheck: true,
      }
    });
    return result.outputText;
  } catch (e) {
    console.warn('TypeScript transpile failed for VSIX; falling back to prebuilt JS:', (e as any)?.message || e);
    return null;
  }
}

export async function buildAndUploadVSIX(opts: BuildVSIXOptions): Promise<{ r2Key: string; downloadUrl: string }>{
  const zip = await loadTemplateVsix();

  // Locate key files within VSIX
  const packageJsonPath = findFirstKeyEnding(zip, '/package.json') || 'extension/package.json';
  const extensionJsPath = findFirstKeyEnding(zip, '/out/extension.js') || 'extension/out/extension.js';
  const manifestPath = findFirstKeyEnding(zip, '.vsixmanifest') || 'extension.vsixmanifest';

  // Read existing package.json from VSIX
  const pkgRaw = await zip.file(packageJsonPath)!.async('string');
  const pkg = JSON.parse(pkgRaw);

  const sid = shortId(opts.pipelineId);
  const displayName = `Contexto MCP (${opts.appName || sid})`;

  // Update package.json
  pkg.name = `contexto-mcp-${sid}`;
  pkg.displayName = displayName;
  pkg.description = `VS Code client for your Contexto MCP server at ${opts.endpoint}`;
  pkg.main = './out/extension.js';
  pkg.activationEvents = [
    'onCommand:contexto.askMCP',
    'onCommand:contexto.listTools',
    'onCommand:contexto.callTool'
  ];
  pkg.contributes = pkg.contributes || {};
  pkg.contributes.commands = [
    { command: 'contexto.askMCP', title: 'Contexto: Ask MCP' },
    { command: 'contexto.listTools', title: 'Contexto: List Tools' },
    { command: 'contexto.callTool', title: 'Contexto: Call Tool' }
  ];
  pkg.contributes.configuration = pkg.contributes.configuration || {
    type: 'object',
    title: 'Contexto MCP Client',
    properties: {}
  };
  pkg.contributes.configuration.properties = pkg.contributes.configuration.properties || {};
  pkg.contributes.configuration.properties['contexto.endpoint'] = {
    type: 'string',
    default: opts.endpoint,
    description: 'Your MCP server URL'
  };

  zip.file(packageJsonPath, JSON.stringify(pkg, null, 2));

  // Compile updated extension.ts and replace JS in VSIX
  const compiledJs = compileExtensionTs();
  if (compiledJs) {
    zip.file(extensionJsPath, compiledJs);
  } else {
    // Fallback: use prebuilt out/extension.js from template dir
    const prebuiltPath = path.join(process.cwd(), 'vscode-extension-template', 'out', 'extension.js');
    const js = await fs.promises.readFile(prebuiltPath, 'utf8');
    zip.file(extensionJsPath, js);
  }

  // Update manifest Identity/DisplayName if present
  if (zip.file(manifestPath)) {
    try {
      let manifestXml = await zip.file(manifestPath)!.async('string');
      manifestXml = manifestXml
        .replace(/DisplayName>[^<]*</, `DisplayName>${displayName}<`)
        .replace(/Identity Id="[^"]+"/, `Identity Id="contexto.mcp.${sid}"`);
      zip.file(manifestPath, manifestXml);
    } catch (e) {
      // Best-effort, ignore manifest update failures
    }
  }

  // Generate VSIX buffer
  const vsixBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  // Upload to R2
  const r2Key = `users/${opts.userId}/extensions/${opts.pipelineId}/contexto-mcp-${sid}.vsix`;
  const uploadUrl = await generateUploadUrl(r2Key, 'application/octet-stream');
  const resp = await fetch(uploadUrl, {
    method: 'PUT',
    body: vsixBuffer,
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(vsixBuffer.length) }
  });
  if (!resp.ok) {
    throw new Error(`Failed to upload VSIX: ${resp.status} ${resp.statusText}`);
  }

  const downloadUrl = await generateDownloadUrl(r2Key);
  return { r2Key, downloadUrl };
}
