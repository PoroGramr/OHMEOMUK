#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="/home/ppp9177/OHMEOMUK"
DEPLOY_HOST="food.porogramr.com"
LOCK_FILE="/tmp/ohmeomuk-production-deploy.lock"

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another OHMEOMUK deployment is already running."
  exit 1
}

if [[ ! -d "$DEPLOY_DIR/.git" ]]; then
  echo "Deployment checkout not found: $DEPLOY_DIR" >&2
  exit 1
fi

if [[ ! -s "$DEPLOY_DIR/.env" ]]; then
  echo "Production .env is missing or empty." >&2
  exit 1
fi

if ! grep -q '^KAKAO_REST_API_KEY=.' "$DEPLOY_DIR/.env"; then
  echo "KAKAO_REST_API_KEY is missing from production .env." >&2
  exit 1
fi

cd "$DEPLOY_DIR"
git fetch --prune origin main
git reset --hard origin/main

docker compose config --quiet
docker compose build
docker compose up -d --remove-orphans

healthy=0
for _ in $(seq 1 60); do
  if curl --fail --silent --show-error \
    --resolve "$DEPLOY_HOST:443:127.0.0.1" \
    "https://$DEPLOY_HOST/api/v1/health" \
    | grep -q '"status":"ok"'; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo "Deployment health check failed." >&2
  docker compose ps
  docker compose logs --no-color --tail=100
  exit 1
fi

curl --fail --silent --show-error \
  --resolve "$DEPLOY_HOST:443:127.0.0.1" \
  --output /dev/null \
  "https://$DEPLOY_HOST/"

docker compose ps
printf 'Deployment verified: https://%s\n' "$DEPLOY_HOST"
