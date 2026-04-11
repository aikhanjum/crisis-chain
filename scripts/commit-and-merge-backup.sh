#!/usr/bin/env bash
set -euo pipefail

echo "Status before commit:" 
git status --porcelain || true

if [ -n "$(git status --porcelain)" ]; then
  echo "Staging all changes..."
  git add -A
  git commit -m "chore: commit local changes before merging backup" || true
else
  echo "No local changes to commit."
fi

BACKUP="backup/main-wip-20260411180502"

echo "Checking out main..."
git checkout main

echo "Merging $BACKUP into main..."
if git merge --no-ff --no-edit "$BACKUP"; then
  echo "Merge successful. Pushing to origin..."
  git push origin main
  echo "PUSH_OK"
else
  echo "Merge failed or conflicts occurred." >&2
  git merge --abort || true
  exit 1
fi

echo "Latest commits:"
git log --oneline -n 5

echo "Status after merge:"
git status --porcelain || true
