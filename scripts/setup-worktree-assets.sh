#!/bin/bash
# setup-worktree-assets.sh
#
# When running in a git worktree, assets/illustrations is gitignored and won't
# be present. This script creates a symlink to the main repo's illustrations so
# worktrees can reference images without duplicating them.

ASSETS_DIR="./assets/illustrations"

# Already exists (directory or valid symlink) — nothing to do
if [ -e "$ASSETS_DIR" ] || [ -L "$ASSETS_DIR" ]; then
  exit 0
fi

# Find the common git directory (main repo's .git)
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null) || exit 0

# In the main repo, git-common-dir is the relative ".git" — skip
if [ "$GIT_COMMON_DIR" = ".git" ]; then
  exit 0
fi

# Derive main repo root from the common .git path
MAIN_REPO_ROOT=$(dirname "$GIT_COMMON_DIR")
MAIN_ILLUSTRATIONS="$MAIN_REPO_ROOT/assets/illustrations"

if [ -d "$MAIN_ILLUSTRATIONS" ]; then
  ln -s "$MAIN_ILLUSTRATIONS" "$ASSETS_DIR"
  echo "Linked assets/illustrations → $MAIN_ILLUSTRATIONS"
else
  echo "Warning: Main repo illustrations not found at $MAIN_ILLUSTRATIONS (images may be missing)"
fi
