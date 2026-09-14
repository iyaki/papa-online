#!/usr/bin/env sh

SCRIPTPATH=$(dirname "$(realpath "$0")")

docker build \
    --build-arg APP_VERSION="$(git -C "${SCRIPTPATH}/.." rev-parse --short HEAD)" \
    --build-arg APP_BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --tag ghcr.io/iyaki/papa-online:latest --push "${SCRIPTPATH}/.."
