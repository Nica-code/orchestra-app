#!/usr/bin/env bash
# Run this on the NEW machine. It checks prerequisites, clones the repo,
# installs dependencies, and restores .env.local + Claude memory from the
# handoff bundle.
#
# One-liner:
#   curl -fsSL https://raw.githubusercontent.com/Nica-code/orchestra-app/main/scripts/handoff-setup.sh | bash
set -e

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; B='\033[0;34m'; N='\033[0m'

echo -e "${B}╔════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  FirstCall — new machine setup                     ║${N}"
echo -e "${B}╚════════════════════════════════════════════════════╝${N}"
echo

# ----- 1. Prerequisites -----
need_node=false
need_git=false

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${Y}Node $(node -v) found, but we need ≥ 20.${N}"
    need_node=true
  else
    echo -e "${G}✓ Node $(node -v)${N}"
  fi
else
  echo -e "${Y}Node not found.${N}"
  need_node=true
fi

if command -v git >/dev/null 2>&1; then
  echo -e "${G}✓ Git $(git --version | awk '{print $3}')${N}"
else
  echo -e "${Y}Git not found.${N}"
  need_git=true
fi

OS="$(uname -s)"
install_if_needed() {
  local pkg="$1"
  if [ "$OS" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "Installing $pkg via Homebrew..."
      brew install "$pkg"
    else
      echo -e "${R}Homebrew not installed.${N}"
      echo "  1) Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
      echo "  2) Re-run this setup script."
      exit 1
    fi
  else
    echo -e "${R}Please install $pkg manually for your OS, then re-run this script.${N}"
    echo "  Node: https://nodejs.org   |   Git: https://git-scm.com"
    exit 1
  fi
}

if $need_node; then install_if_needed node; fi
if $need_git; then install_if_needed git; fi

# Allow piping into bash by reading user input from /dev/tty
ask() { # ask "Prompt" "default"
  local prompt="$1"; local default="$2"; local answer
  if [ -t 0 ]; then
    read -p "$prompt [$default]: " answer
  else
    read -p "$prompt [$default]: " answer </dev/tty
  fi
  echo "${answer:-$default}"
}

# ----- 2. Clone or pull the repo -----
DEFAULT_DIR="$HOME/Downloads/Apps/orchestra-app"
echo
INSTALL_DIR=$(ask "Install path" "$DEFAULT_DIR")

if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "${G}Repo already exists at $INSTALL_DIR — pulling latest...${N}"
  ( cd "$INSTALL_DIR" && git pull )
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  echo "Cloning from GitHub..."
  git clone https://github.com/Nica-code/orchestra-app.git "$INSTALL_DIR"
fi

# ----- 3. Install dependencies -----
echo
echo "Running npm install (takes a minute or two)..."
( cd "$INSTALL_DIR" && npm install )
echo -e "${G}✓ Dependencies installed${N}"

# ----- 4. Restore handoff bundle -----
DEFAULT_TAR="$HOME/Downloads/firstcall-handoff.tar.gz"
echo
TAR=$(ask "Path to handoff bundle" "$DEFAULT_TAR")

if [ ! -f "$TAR" ]; then
  echo -e "${Y}No handoff bundle found at $TAR — skipping secrets/memory restore.${N}"
  echo "You'll need to manually copy .env.local from your other machine."
else
  WORK="$(mktemp -d)"
  tar -C "$WORK" -xzf "$TAR"

  if [ -f "$WORK/payload/.env.local" ]; then
    cp "$WORK/payload/.env.local" "$INSTALL_DIR/.env.local"
    echo -e "${G}✓ Restored .env.local${N}"
  fi

  if [ -d "$WORK/payload/memory" ]; then
    MEM_DIR_NAME=$(echo "$INSTALL_DIR" | tr / -)
    MEM_DEST="$HOME/.claude/projects/$MEM_DIR_NAME"
    mkdir -p "$MEM_DEST"
    rm -rf "$MEM_DEST/memory"
    cp -R "$WORK/payload/memory" "$MEM_DEST/memory"
    echo -e "${G}✓ Restored Claude memory to $MEM_DEST/memory${N}"
  fi
  rm -rf "$WORK"
fi

# ----- 5. Done -----
echo
echo -e "${G}╔════════════════════════════════════════════════════╗${N}"
echo -e "${G}║  Setup complete                                    ║${N}"
echo -e "${G}╚════════════════════════════════════════════════════╝${N}"
echo
echo "Project: $INSTALL_DIR"
echo
echo "Start the app:"
echo -e "  ${B}cd $INSTALL_DIR && npm run dev${N}"
echo
echo "To brief Claude Code / Codex on this project, open and paste:"
echo -e "  ${B}$INSTALL_DIR/CLAUDE_HANDOFF_PROMPT.md${N}"
echo
