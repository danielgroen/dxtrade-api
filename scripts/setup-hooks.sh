#!/bin/sh

# Skip if not in a git repo (e.g. installed as a dependency)
[ -d .git ] || exit 0

mkdir -p .git/hooks

cat > .git/hooks/pre-commit << 'HOOK'
#!/bin/sh

if [ -z "$COMMITIZEN" ] && [ -z "$CI" ]; then
  echo ""
  echo "  Direct git commit is disabled."
  echo "  Use: npm run commit"
  echo ""
  exit 1
fi
HOOK

chmod +x .git/hooks/pre-commit
