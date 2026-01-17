#!/bin/bash

# GitHub Push Script with Personal Access Token
# Usage: ./push.sh [commit_message]

set -e

# Load credentials
if [ -f ".github_credentials" ]; then
    source .github_credentials
else
    echo "❌ Error: .github_credentials file not found!"
    echo "Please create the file with your GitHub token."
    exit 1
fi

# Check if token exists
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN not found in .github_credentials"
    exit 1
fi

# Default commit message
COMMIT_MSG="${1:-Auto-commit: $(date +'%Y-%m-%d %H:%M:%S')}"

# Add all changes
echo "📝 Adding changes..."
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️  No changes to commit"
    exit 0
fi

# Commit changes
echo "💾 Committing changes..."
git commit -m "$COMMIT_MSG"

# Push with token
echo "🚀 Pushing to GitHub..."
REPO_URL="https://$GIT_USER:$GITHUB_TOKEN@github.com/$GIT_USER/baileys-whatsapp.git"
git push "$REPO_URL" main

echo "✅ Successfully pushed to GitHub!"
echo "📊 Repository: https://github.com/$GIT_USER/baileys-whatsapp"