#!/usr/bin/env bash
# Run after `npx cap add android`: installs the native print plugin and MainActivity.
set -e
PKG=$(node -p "require('./capacitor.config.json').appId")
DIR=android/app/src/main/java/$(echo "$PKG" | tr . /)
mkdir -p "$DIR"
for f in PrintPlugin MainActivity; do sed "s/__PKG__/$PKG/" native/$f.java > "$DIR/$f.java"; done
echo "Native files installed in $DIR"
