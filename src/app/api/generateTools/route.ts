import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getFileDownloadUrls } from '@/lib/storage';
import { extractTextFromFiles } from '@/lib/text-processor';
import { getAzureOpenAIClient } from '@/lib/azure-openai';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }
    
    const userId = authResult.userId;
    
    // Parse request body
    const body = await request.json();
    const { fileIds, description } = body;
    
    if (!fileIds?.length && !description) {
      return NextResponse.json(
        { error: 'Either fileIds or description must be provided' },
        { status: 400 }
      );
    }
    
    // Get file content if fileIds are provided
    let fileContents: string[] = [];
    let extractedContents: Array<{ text: string; fileName: string; fileId: string }> = [];
    
    if (fileIds?.length > 0) {
      // Get download URLs for the files - we need to fetch file metadata first
      const fileMetadata = await Promise.all(fileIds.map(async (fileId: string) => {
        // In a real implementation, you would fetch this from your database
        // This is a placeholder implementation
        return {
          fileId,
          key: `${userId}/${fileId}/file.txt`, // Placeholder key format
          fileName: `file-${fileId}.txt`, // Placeholder filename
          contentType: 'text/plain' // Placeholder content type
        };
      }));
      
      const downloadUrls = await getFileDownloadUrls(fileMetadata);
      
      // Extract text from files
      extractedContents = await extractTextFromFiles(downloadUrls);
      
      // Map the extracted content to just the text strings
      fileContents = extractedContents.map(item => item.text);
    }
    
    // Combine file contents and description
    const context = [
      ...fileContents,
      description || ''
    ].filter(Boolean).join('\n\n');
    
    // Generate tools using Azure OpenAI
    const tools = await generateToolsWithAI(context);
    
    return NextResponse.json({ tools });
  } catch (error) {
    console.error('Error generating tools:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate tools' },
      { status: 500 }
    );
  }
}

async function generateToolsWithAI(context: string) {
  const openai = await getAzureOpenAIClient();
  
  const systemPrompt = `You are an expert AI assistant that helps create Model Context Protocol (MCP) tools based on provided content.
Analyze the content and generate appropriate tools that would be useful for interacting with this data.
Each tool should have:
1. A clear, descriptive name
2. A concise description of what the tool does
3. Parameters that the tool accepts, each with name, type, description, and whether it's required

Respond with a JSON array of tools in this format:
[
  {
    "name": "toolName",
    "description": "Tool description",
    "parameters": [
      {
        "name": "paramName",
        "type": "string|number|boolean|array|object",
        "description": "Parameter description",
        "required": true|false
      }
    ]
  }
]

Generate between 2-5 tools that would be most useful for this content.`;

  const userPrompt = `Here is the content to analyze and generate tools for:\n\n${context}`;
  
  const response = await openai.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });
  
  try {
    const content = response.choices[0]?.message?.content || '{"tools": []}';
    const parsedResponse = JSON.parse(content);
    return Array.isArray(parsedResponse.tools) ? parsedResponse.tools : [];
  } catch (error) {
    console.error('Error parsing AI response:', error);
    return [];
  }
}
