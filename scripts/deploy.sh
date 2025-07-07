#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "====== Starting Contexto Production Deployment ======"

# Step 1: Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# Step 2: Run tests
echo "Running tests..."
npm test

# Step 3: Build the application
echo "Building application..."
npm run build

# Step 4: Deploy Firebase Firestore rules
echo "Deploying Firestore rules..."
firebase deploy --only firestore:rules

# Step 5: Deploy Firebase Functions
echo "Deploying Firebase Functions..."
firebase deploy --only functions

# Step 6: Deploy Firebase Hosting
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "====== Deployment Complete ======"
echo "Your Contexto application is now live!"
