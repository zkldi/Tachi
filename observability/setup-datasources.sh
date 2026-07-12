#!/usr/bin/env bash
set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://tachi-grafana:3000}"
GRAFANA_USER="${GRAFANA_USER:-tachi}"
GRAFANA_PASS="${GRAFANA_PASS:-tachi}"

PROM_URL="${PROM_URL:-http://tachi-prometheus:9090}"
ALLOY_URL="${ALLOY_URL:-http://tachi-alloy:12345}"

MAX_WAIT="${MAX_WAIT:-60}"

auth="${GRAFANA_USER}:${GRAFANA_PASS}"

wait_for_grafana() {
  local elapsed=0

  printf "Waiting for Grafana at %s " "$GRAFANA_URL"
  while ! curl -sf -o /dev/null "${GRAFANA_URL}/api/health" 2>/dev/null; do
    if (( elapsed >= MAX_WAIT )); then
      printf "\nGrafana did not become ready within %ds\n" "$MAX_WAIT" >&2
      exit 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    printf "."
  done
  printf " ready (%ds)\n" "$elapsed"
}

upsert_datasource() {
  local name="$1" type="$2" url="$3" is_default="$4"

  local existing
  existing=$(curl -sf -u "$auth" "${GRAFANA_URL}/api/datasources/name/${name}" 2>/dev/null || true)

  local payload
  payload=$(cat <<EOF
{
  "name": "${name}",
  "type": "${type}",
  "access": "proxy",
  "url": "${url}",
  "isDefault": ${is_default},
  "editable": true
}
EOF
  )

  if [ -n "$existing" ] && echo "$existing" | grep -q '"id"'; then
    if echo "$existing" | grep -q '"readOnly":true'; then
      printf "  %-12s ok (provisioned, read-only)\n" "$name"
      return 0
    fi

    local uid
    uid=$(echo "$existing" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4)

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -u "$auth" \
      -X PUT "${GRAFANA_URL}/api/datasources/uid/${uid}" \
      -H "Content-Type: application/json" \
      -d "$payload")

    if [ "$status" = "200" ]; then
      printf "  %-12s updated (uid=%s)\n" "$name" "$uid"
    else
      printf "  %-12s update failed (HTTP %s)\n" "$name" "$status" >&2
      return 1
    fi
  else
    local resp
    resp=$(curl -s -u "$auth" \
      -X POST "${GRAFANA_URL}/api/datasources" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>&1) || true

    if echo "$resp" | grep -q '"datasource"'; then
      local uid
      uid=$(echo "$resp" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4)
      printf "  %-12s created (uid=%s)\n" "$name" "$uid"
    elif echo "$resp" | grep -q "data source with the same name already exists"; then
      printf "  %-12s already exists (provisioned)\n" "$name"
    else
      printf "  %-12s create failed: %s\n" "$name" "$resp" >&2
      return 1
    fi
  fi
}

health_check() {
  local name="$1"

  local resp
  resp=$(curl -sf -u "$auth" "${GRAFANA_URL}/api/datasources/name/${name}" 2>/dev/null || true)

  if [ -z "$resp" ]; then
    printf "  %-12s not found\n" "$name" >&2
    return 1
  fi

  local uid
  uid=$(echo "$resp" | grep -o '"uid":"[^"]*"' | head -1 | cut -d'"' -f4)

  local check
  check=$(curl -sf -u "$auth" \
    -X POST "${GRAFANA_URL}/api/datasources/uid/${uid}/health" \
    -H "Content-Type: application/json" 2>&1) || true

  if echo "$check" | grep -q '"status":"OK"'; then
    printf "  %-12s healthy\n" "$name"
  elif echo "$check" | grep -q '"status":"ERROR"'; then
    local msg
    msg=$(echo "$check" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
    printf "  %-12s unhealthy: %s\n" "$name" "$msg" >&2
    return 1
  else
    printf "  %-12s health unknown (endpoint may not be supported)\n" "$name"
  fi
}

reload_provisioning() {
  local kind="$1"

  local status
  status=$(curl -sf -o /dev/null -w "%{http_code}" -u "$auth" \
    -X POST "${GRAFANA_URL}/api/admin/provisioning/${kind}/reload" 2>/dev/null) || true

  if [ "$status" = "200" ]; then
    printf "  %-12s reloaded\n" "$kind"
  else
    printf "  %-12s reload failed (HTTP %s)\n" "$kind" "$status" >&2
  fi
}

wait_for_grafana

echo "Registering datasources:"
upsert_datasource "Prometheus" "prometheus" "$PROM_URL" "true"

echo "Reloading provisioning:"
reload_provisioning "datasources"
reload_provisioning "dashboards"

echo "Health checks:"
health_check "Prometheus"
health_check "Postgres"

echo "Reloading Alloy config:"
alloy_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${ALLOY_URL}/-/reload" 2>/dev/null) || true
if [ "$alloy_status" = "200" ]; then
  printf "  %-12s reloaded\n" "Alloy"
else
  printf "  %-12s reload failed (HTTP %s)\n" "Alloy" "$alloy_status" >&2
fi

echo "Done."
