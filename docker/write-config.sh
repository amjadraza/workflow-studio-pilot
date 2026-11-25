#!/bin/sh
# Writes config.js from environment variables when the container starts,
# so the API key is never stored in the image.
cat > /usr/share/nginx/html/config.js <<CONFIG
window.APP_CONFIG = {
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:-}",
  ANTHROPIC_MODEL: "${ANTHROPIC_MODEL:-claude-sonnet-5-5}"
};
CONFIG
echo "config.js written (live mode: $([ -n "$ANTHROPIC_API_KEY" ] && echo on || echo off))"
