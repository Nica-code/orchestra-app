#!/usr/bin/env bash
# Run this on the CURRENT machine. It pushes the latest commit to GitHub
# and bundles your secrets + Claude memory into ~/firstcall-handoff.tar.gz
# for transfer to the new machine.
set -e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; N='\033[0m'

echo -e "${B}FirstCall — handoff packer${N}"
echo

# Must run from project root
if [ ! -f "package.json" ] || ! grep -q '"orchestra-app"' package.json; then
  echo -e "${R}Run this from the orchestra-app project root.${N}"
  exit 1
fi

# 1. Push the latest commit to GitHub
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${Y}You have uncommitted changes. Committing them now...${N}"
  git add .
  git commit -m "Pre-handoff snapshot" || true
fi
echo "Pushing to GitHub..."
git push
echo -e "${G}✓ GitHub is up to date${N}"
echo

# 2. Bundle .env.local + memory
TMPDIR="$(mktemp -d)"
mkdir -p "$TMPDIR/payload"

if [ -f ".env.local" ]; then
  cp ".env.local" "$TMPDIR/payload/.env.local"
  echo -e "${G}✓ Bundled .env.local${N}"
else
  echo -e "${Y}Warning: .env.local not found — skipping.${N}"
fi

PROJECT_ABS="$(pwd)"
MEM_DIR_NAME=$(echo "$PROJECT_ABS" | tr / -)
MEM_SRC="$HOME/.claude/projects/$MEM_DIR_NAME/memory"
if [ -d "$MEM_SRC" ]; then
  cp -R "$MEM_SRC" "$TMPDIR/payload/memory"
  echo -e "${G}✓ Bundled Claude memory ($MEM_SRC)${N}"
else
  echo -e "${Y}No Claude memory at $MEM_SRC — skipping.${N}"
fi

OUT="$HOME/firstcall-handoff.tar.gz"
tar -C "$TMPDIR" -czf "$OUT" payload
rm -rf "$TMPDIR"

echo
echo -e "${G}╔════════════════════════════════════════════════════╗${N}"
echo -e "${G}║  Handoff bundle ready                              ║${N}"
echo -e "${G}╚════════════════════════════════════════════════════╝${N}"
echo
echo "File: $OUT"
echo
echo "Next steps:"
echo "  1. Transfer this file to the new computer (AirDrop / USB / secure cloud)."
echo "     Drop it at: ~/Downloads/firstcall-handoff.tar.gz"
echo
echo "  2. On the new computer, open Terminal and paste this one command:"
echo
echo -e "     ${B}curl -fsSL https://raw.githubusercontent.com/Nica-code/orchestra-app/main/scripts/handoff-setup.sh | bash${N}"
echo
echo "  3. After setup finishes, delete the bundle from any shared cloud location."
echo
