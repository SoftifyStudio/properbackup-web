#!/usr/bin/env bash
set -euo pipefail

# ProperBackup Agent Installer
# Downloads a self-contained agent with bundled JRE — no Java required.
# Usage: curl -sL https://dl.properbackup.com/install.sh | sudo bash -s -- <ACTIVATION_TOKEN>

INSTALL_DIR="/opt/properbackup"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[ProperBackup]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ProperBackup]${NC} $1"; }
error() { echo -e "${RED}[ProperBackup]${NC} $1" >&2; }

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
    error "Usage: curl -sL https://dl.properbackup.com/install.sh | sudo bash -s -- <TOKEN>"
    error "Get your activation token from https://panel.properbackup.com"
    exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    error "This script must be run as root (use sudo)"
    exit 1
fi

detect_arch() {
    local arch
    arch="$(uname -m)"
    case "$arch" in
        x86_64|amd64)  echo "x64" ;;
        aarch64|arm64) echo "aarch64" ;;
        *)             error "Unsupported architecture: $arch"; exit 1 ;;
    esac
}

detect_os() {
    local os
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    case "$os" in
        linux*)  echo "linux" ;;
        darwin*) echo "macos" ;;
        *)       error "Unsupported OS: $os (use Windows installer instead)"; exit 1 ;;
    esac
}

download_agent() {
    local os arch url
    os="$(detect_os)"
    arch="$(detect_arch)"
    url="https://dl.properbackup.com/agent/latest/properbackup-agent-${os}-${arch}.tar.gz"

    info "Downloading ProperBackup agent ($os/$arch)..."

    mkdir -p "$INSTALL_DIR"

    if command -v curl &>/dev/null; then
        curl -sL "$url" | tar xz -C "$INSTALL_DIR" --strip-components=1
    elif command -v wget &>/dev/null; then
        wget -qO- "$url" | tar xz -C "$INSTALL_DIR" --strip-components=1
    else
        error "Neither curl nor wget found."
        exit 1
    fi

    chmod +x "$INSTALL_DIR/properbackup-agent"
    info "Agent installed to $INSTALL_DIR/"
}

activate_agent() {
    info "Activating agent with token $TOKEN..."
    "$INSTALL_DIR/properbackup-agent" --activate "$TOKEN"
    info "Agent activated"
}

install_service() {
    info "Installing systemd service..."
    "$INSTALL_DIR/properbackup-agent" --install-service

    sleep 2

    if systemctl is-active --quiet properbackup-agent 2>/dev/null; then
        info "Service is running"
    else
        warn "Service installed but may not be running yet. Check: systemctl status properbackup-agent"
    fi
}

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      ProperBackup Agent Installer    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

download_agent
activate_agent
install_service

echo ""
info "All done! Your server is now being backed up."
info "Check status:  systemctl status properbackup-agent"
info "View logs:     journalctl -u properbackup-agent -f"
info "Dashboard:     https://panel.properbackup.com"
echo ""
