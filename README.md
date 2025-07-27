# Contexto - MCP Pipeline Builder

Contexto is a powerful chat-driven interface for building and deploying MCP (Model Control Protocol) pipelines. It provides a seamless experience for creating, managing, and deploying ML pipelines with a focus on simplicity and developer experience.

## Features

- 🚀 **One-click deployment** to Heroku
- 💬 **Chat-driven interface** for pipeline creation
- 🔄 **Real-time status updates** for deployments
- 🔒 **Secure authentication** with Firebase
- 📦 **Built-in vector store** support (Pinecone, Qdrant, Supabase)
- 🤖 **Azure OpenAI** integration for embeddings and chat

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Firebase project with Firestore
- Heroku account and API key
- Azure OpenAI service (for embeddings and chat)
- Vector store account (Pinecone, Qdrant, or Supabase)

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   # or
   pnpm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your environment variables
4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

### Heroku Deployment

Contexto supports one-click deployment to Heroku. You'll need to set up the following environment variables in your Heroku app:

#### Required Environment Variables

```
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key Here\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# Azure OpenAI
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_EMBEDDING=text-embedding-ada-002
AZURE_OPENAI_DEPLOYMENT_TURBO=gpt-35-turbo

# Heroku
HEROKU_API_KEY=your-heroku-api-key
HEROKU_REGION=us  # or eu

# Cloudflare R2 (for file storage)
CF_R2_ACCESS_KEY_ID=your-r2-access-key-id
CF_R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
CF_R2_BUCKET_NAME=contexto-uploads
CF_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

#### Deployment Process

1. **Prepare your pipeline** in the Contexto UI
2. Click the **Deploy to Heroku** button
3. Monitor the deployment status in the modal
4. Once deployed, you'll receive a URL to access your MCP server

### Custom Domains (Optional)

To use a custom domain with your Heroku app:

1. Go to your Heroku Dashboard
2. Select your app
3. Navigate to Settings > Domains
4. Add your custom domain
5. Configure your DNS to point to the Heroku DNS target

## Architecture

Contexto is built with:

- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **Deployment**: Heroku Platform API
- **Vector Stores**: Pinecone, Qdrant, or Supabase
- **Embeddings**: Azure OpenAI

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
# contexto
