import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const dotEnvPath = path.join(projectRoot, '.env');

if (!fs.existsSync(dotEnvPath)) {
  console.log('\x1b[33m%s\x1b[0m', '.env not found in the current directory. Checking if this is a Git worktree...');
  
  const gitPath = path.join(projectRoot, '.git');
  if (fs.existsSync(gitPath)) {
    const stat = fs.statSync(gitPath);
    if (stat.isFile()) {
      // It's a git worktree file!
      try {
        const gitContent = fs.readFileSync(gitPath, 'utf-8').trim();
        // Format: gitdir: /path/to/main/repo/.git/worktrees/worktree-name
        const match = gitContent.match(/^gitdir:\s*(.+)$/);
        if (match) {
          const worktreeGitDir = match[1].trim();
          
          // worktreeGitDir points to something like "/path/to/main/repo/.git/worktrees/worktree-name"
          // We can locate the main repo directory by finding the index of '.git'
          const gitDirIndex = worktreeGitDir.indexOf('.git');
          if (gitDirIndex !== -1) {
            const mainRepoDir = worktreeGitDir.substring(0, gitDirIndex);
            const mainEnvPath = path.join(mainRepoDir, '.env');
            
            if (fs.existsSync(mainEnvPath)) {
              fs.copyFileSync(mainEnvPath, dotEnvPath);
              console.log('\x1b[32m%s\x1b[0m', `Successfully copied .env from main repository (${mainRepoDir}) to worktree.`);
            } else {
              console.log('\x1b[31m%s\x1b[0m', `Main repository at ${mainRepoDir} does not have a .env file.`);
              copyEnvExample();
            }
          } else {
            console.log('Could not determine main repository location from .git file.');
            copyEnvExample();
          }
        }
      } catch (err) {
        console.error('Failed to parse .git worktree file:', err);
        copyEnvExample();
      }
    } else {
      console.log('This is the main repository clone (not a worktree).');
      copyEnvExample();
    }
  } else {
    copyEnvExample();
  }
}

function copyEnvExample() {
  const examplePath = path.join(projectRoot, '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, dotEnvPath);
    console.log('\x1b[36m%s\x1b[0m', 'Copied .env.example to .env as fallback.');
  } else {
    console.log('\x1b[31m%s\x1b[0m', 'No .env.example found to copy.');
  }
}
