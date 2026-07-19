#!/bin/bash
# Installiert den Cockpit-Runner als launchd-Agent (Autostart + KeepAlive).
# Idempotent: erneutes Ausführen aktualisiert die Konfiguration.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
PLIST_LABEL="de.uriel.runner"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
LOG_DIR="$HOME/Library/Logs/kevin-os"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$REPO_DIR/runner/index.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/cockpit-runner.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/cockpit-runner.err.log</string>
</dict>
</plist>
PLIST

# Neu laden (bootout schlägt beim ersten Mal fehl — ok)
launchctl bootout "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo "✓ Runner-Autostart installiert ($PLIST_LABEL)"
echo "  Logs: $LOG_DIR/cockpit-runner.log"
echo "  Status: curl -s http://127.0.0.1:4711/status"
