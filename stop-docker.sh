#!/usr/bin/env bash

echo "=== Running containers ==="
docker ps

echo
echo "=== Stopping all running containers ==="
docker ps -q | xargs -r docker stop

echo
echo "=== Removing all containers ==="
docker ps -aq | xargs -r docker rm -f

echo
echo "=== Remaining containers ==="
docker ps -a