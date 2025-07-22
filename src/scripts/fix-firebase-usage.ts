/**
 * Script to fix common Firebase Admin SDK usage patterns
 * 
 * This script will:
 * 1. Find files that use Firebase Admin SDK
 * 2. Fix common patterns like missing await, incorrect method calls, etc.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

// Helper function to replace getFirestore without await
function fixMissingAwaitFirestore(content: string): string {
  return content.replace(
    /const\s+(\w+)\s*=\s*getFirestore\(\);/g,
    'const $1 = await getFirestore();'
  );
}

// Helper function to replace getAuth without await
function fixMissingAwaitAuth(content: string): string {
  return content.replace(
    /const\s+(\w+)\s*=\s*getAuth\(\);/g,
    'const $1 = await getAuth();'
  );
}

// Helper function to fix getFirebaseAdmin().firestore() pattern
function fixFirebaseAdminFirestore(content: string): string {
  return content.replace(
    /getFirebaseAdmin\(\)\.firestore\(\)/g,
    'await getFirestore()'
  );
}

// Helper function to fix getFirebaseAdmin().storage() pattern
function fixFirebaseAdminStorage(content: string): string {
  return content.replace(
    /getFirebaseAdmin\(\)\.storage\(\)/g,
    'await getFirebaseAdmin(); admin.storage()'
  );
}

// Helper function to fix admin.firestore() without await getFirebaseAdmin()
function fixAdminFirestoreWithoutAwait(content: string): string {
  return content.replace(
    /const\s+(\w+)\s*=\s*admin\.firestore\(\);\s*(?!\s*await\s+getFirebaseAdmin\(\);)/g,
    'await getFirebaseAdmin();\nconst $1 = admin.firestore();'
  );
}

// Get all TypeScript files in the src directory
const files = glob.sync('src/**/*.ts', { ignore: ['src/node_modules/**', 'src/scripts/fix-firebase-usage.ts'] });

console.log(`Found ${files.length} TypeScript files to check`);

let totalFilesFixed = 0;
let totalMatchesFixed = 0;

// Process each file
files.forEach(file => {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileMatches = 0;
  
  // Apply each fix function and count matches
  const fixFunctions = [
    fixMissingAwaitFirestore,
    fixMissingAwaitAuth,
    fixFirebaseAdminFirestore,
    fixFirebaseAdminStorage,
    fixAdminFirestoreWithoutAwait
  ];
  
  for (const fixFn of fixFunctions) {
    const newContent = fixFn(content);
    if (newContent !== content) {
      fileMatches++;
      content = newContent;
    }
  }
  
  // Write changes if the file was modified
  if (originalContent !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${fileMatches} matches in ${file}`);
    totalFilesFixed++;
    totalMatchesFixed += fileMatches;
  }
});

console.log(`\nSummary:`);
console.log(`- Fixed ${totalMatchesFixed} issues in ${totalFilesFixed} files`);
console.log(`- ${files.length - totalFilesFixed} files were already correct`);
