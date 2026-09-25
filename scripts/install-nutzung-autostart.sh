#!/bin/bash
# Meldet die Token-Nutzung dieses Rechners alle 30 Minuten nach Uriel
# (scripts/nutzung-melden.mjs). NUR auf dem Laptop nötig — auf dem Mini
# erledigt das der Runner. Idempotent.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
# Ein LaunchAgent erbt keinen PATH — die Plan-Abfrage braucht `claude`.
CLAUDE_DIR="$(dirname "$(command -v claude)")"
PLIST_LABEL="de.uriel.nutzung"
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
    <string>$REPO_DIR/scripts/nutzung-melden.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$CLAUDE_DIR:$(dirname "$NODE_BIN"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>1800</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/nutzung-melden.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/nutzung-melden.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo "✓ Nutzungs-Meldung installiert ($PLIST_LABEL, alle 30 Minuten)"
echo "  Logs: $LOG_DIR/nutzung-melden.log"
