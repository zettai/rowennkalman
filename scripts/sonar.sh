#!/usr/bin/env bash
# On-demand SonarQube scan against sona-z, then a short issue summary.
#   scripts/sonar.sh            tests with coverage, scan, summary
#   scripts/sonar.sh --issues   summary of the last analysis only (no scan)
# The token is a project analysis token kept in the macOS Keychain ("rowennkalman-sonar-token"),
# read for this command only; never in .env.local (that file holds production settings).
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${SONAR_HOST_URL:-http://192.168.254.33:9000}"
KEY="rowennkalman"
TOKEN="$(security find-generic-password -a "$USER" -s rowennkalman-sonar-token -w 2>/dev/null || true)"
[ -n "$TOKEN" ] || { echo "No token: add the Keychain item rowennkalman-sonar-token (see docs/PLAN.md)."; exit 1; }
curl -sf -m 10 "$HOST/api/system/status" >/dev/null || { echo "SonarQube not reachable at $HOST"; exit 1; }

if [ "${1:-}" != "--issues" ] && [ -n "$(git status --porcelain -- src scripts tests e2e)" ]; then
  echo "Note: uncommitted changes. SonarQube can't blame those lines (\"Missing blame information\")"
  echo "      and new-code tracking is less accurate. Commit first for a clean analysis."
fi

if [ "${1:-}" != "--issues" ]; then
  echo "1/3 tests with coverage"
  npm run -s test:coverage >/tmp/rk-coverage.log 2>&1 || { tail -20 /tmp/rk-coverage.log; exit 1; }
  echo "2/3 scanning"
  rm -rf .scannerwork
  # The version sets SonarQube's "new code" window (Previous version): bump package.json's version
  # after a release to start a fresh window.
  VERSION="$(node -p "require('./package.json').version")"
  SONAR_TOKEN="$TOKEN" sonar-scanner -Dsonar.host.url="$HOST" -Dsonar.projectVersion="$VERSION" -Dsonar.qualitygate.wait=true -Dsonar.qualitygate.timeout=300 >/tmp/rk-sonar.log 2>&1 \
    || { grep -E "ERROR|QUALITY GATE" /tmp/rk-sonar.log | tail -5; echo "(full log: /tmp/rk-sonar.log)"; }
fi

echo "3/3 results"
curl -s -u "$TOKEN:" "$HOST/api/qualitygates/project_status?projectKey=$KEY" \
  | python3 -c "import sys,json; print('Quality gate:', json.load(sys.stdin).get('projectStatus',{}).get('status','?'))"
curl -s -u "$TOKEN:" "$HOST/api/measures/component?component=$KEY&metricKeys=bugs,vulnerabilities,security_hotspots,code_smells,coverage,duplicated_lines_density,ncloc" \
  | python3 -c "
import sys,json
m={x['metric']:x.get('value','?') for x in json.load(sys.stdin).get('component',{}).get('measures',[])}
print('  '.join(f'{k}={m.get(k,\"?\")}' for k in ['ncloc','bugs','vulnerabilities','security_hotspots','code_smells','coverage','duplicated_lines_density']))"
curl -s -u "$TOKEN:" "$HOST/api/issues/search?componentKeys=$KEY&resolved=false&ps=500&s=SEVERITY&asc=false" \
  | python3 -c "
import sys,json,collections
d=json.load(sys.stdin); iss=d.get('issues',[])
print('Open issues:', d.get('total',0), dict(collections.Counter(i['severity'] for i in iss)))
for i in iss[:40]:
    f=i['component'].split(':',1)[-1]; ln=(i.get('textRange') or {}).get('startLine','')
    print(f\"  {i['severity']:<8} {i['rule']:<28} {f}:{ln}  {i['message'][:110]}\")"
echo "Dashboard: $HOST/dashboard?id=$KEY"
