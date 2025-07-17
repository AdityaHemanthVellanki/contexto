import { NextRequest, NextResponse } from 'next/server';
import { ConversationService } from '@/services/conversation';
import { getAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { action, sessionId, userInput } = body;

    switch (action) {
      case 'create_session':
        const session = await ConversationService.createSession(userId);
        return NextResponse.json({ session });

      case 'get_session':
        if (!sessionId) {
          return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
        }
        const existingSession = await ConversationService.getSession(sessionId);
        return NextResponse.json({ session: existingSession });

      case 'get_active_session':
        const activeSession = await ConversationService.getActiveSession(userId);
        return NextResponse.json({ session: activeSession });

      case 'process_input':
        if (!sessionId || !userInput) {
          return NextResponse.json({ error: 'Session ID and user input required' }, { status: 400 });
        }
        
        // Add user message to conversation
        await ConversationService.addMessage(sessionId, {
          role: 'user',
          content: userInput
        });

        // Process input and get response
        const response = await ConversationService.processUserInput(sessionId, userInput);
        
        // Add assistant response to conversation
        await ConversationService.addMessage(sessionId, {
          role: 'assistant',
          content: response.error ? 
            `${response.error}\n\n${response.nextQuestion}` : 
            response.nextQuestion,
          metadata: {
            isValid: !response.error,
            error: response.error
          }
        });

        return NextResponse.json(response);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get active session for user
    const activeSession = await ConversationService.getActiveSession(userId);
    return NextResponse.json({ session: activeSession });
  } catch (error) {
    console.error('Conversation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
