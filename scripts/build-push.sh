#!/usr/bin/env sh

SCRIPTPATH=$(dirname "$(realpath "$0")")

docker build --tag ghcr.io/iyaki/papa-online:latest --push ${SCRIPTPATH}/..
