import type { NextApiRequest, NextApiResponse } from 'next';

// This endpoint is just for testing firebase config
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check client-side Firebase config
  const clientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Set' : '❌ Missing',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? '✅ Set' : '❌ Missing',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? '✅ Set' : '❌ Missing'
  };

  // Check server-side Firebase Admin config
  let adminCredentials = '❌ Missing';
  if (process.env.FIREBASE_ADMIN_CREDENTIALS) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
      adminCredentials = parsed.project_id ? 
        `✅ Set (Project: ${parsed.project_id})` : 
        '⚠️ Invalid format';
    } catch (e) {
      adminCredentials = '⚠️ Invalid JSON format';
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminCredentials = `✅ Using file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`;
  }

  return res.status(200).json({
    clientConfig,
    adminCredentials,
    environment: process.env.NODE_ENV,
    note: 'Do not expose this in production!'
  });
}
