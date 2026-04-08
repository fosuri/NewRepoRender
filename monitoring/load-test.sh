#!/bin/bash

# Load Testing Script for Monitoring Stack
# Teeb erinevaid load teste ja triggib häireid

set -e

RESET='\033[0m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'

# Seadistused
DEFAULT_URL="http://localhost:3000"
DEFAULT_TEST_TYPE="medium"

# Kasutaja sisend
TARGET_URL="${1:-$DEFAULT_URL}"
TEST_TYPE="${2:-$DEFAULT_TEST_TYPE}"

# Funktsioonid
print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${BLUE}║   🧪 Load Testing Skript                                  ║${RESET}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
}

print_usage() {
    echo -e "${YELLOW}Kasutamine:${RESET}"
    echo "  ./load-test.sh [URL] [TEST_TYPE]"
    echo ""
    echo -e "${YELLOW}Näited:${RESET}"
    echo "  ./load-test.sh                              # Vaikimisi kerge test"
    echo "  ./load-test.sh http://localhost:3000 medium # Keskmise koormusega"
    echo "  ./load-test.sh http://localhost:3000 heavy  # Raske test"
    echo "  ./load-test.sh http://localhost:3000 spike  # Spike test"
    echo ""
    echo -e "${YELLOW}Koormusega tüübid:${RESET}"
    echo "  light    - 1 000 päringut, 10 concurrent"
    echo "  medium   - 10 000 päringut, 50 concurrent"
    echo "  heavy    - 100 000 päringut, 500 concurrent"
    echo "  spike    - k6 ramping test (7 min)"
    echo ""
}

test_light() {
    echo -e "${YELLOW}Käivitan kerge load testi (1000 päringut, 10 concurrent)...${RESET}"
    ab -n 1000 -c 10 "$TARGET_URL/" || echo -e "${RED}❌ Test ebaõnnestus${RESET}"
}

test_medium() {
    echo -e "${YELLOW}Käivitan keskmise koormusega testi (10000 päringut, 50 concurrent)...${RESET}"
    ab -n 10000 -c 50 "$TARGET_URL/" || echo -e "${RED}❌ Test ebaõnnestus${RESET}"
}

test_heavy() {
    echo -e "${YELLOW}Käivitan rasket load testi (100000 päringut, 500 concurrent)...${RESET}"
    echo -e "${RED}⚠️  Hoiatus: See test on VÄGA raske ja triggib häireid!${RESET}"
    read -p "Jätka? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ab -n 100000 -c 500 "$TARGET_URL/" || echo -e "${RED}❌ Test ebaõnnestus${RESET}"
    else
        echo -e "${YELLOW}Test tühistatud${RESET}"
    fi
}

test_spike() {
    echo -e "${YELLOW}Käivitan spike testi (k6 ramping test)...${RESET}"
    
    # Kontrolli, kas k6 on installitud
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}❌ k6 pole installitud! Käivita:${RESET}"
        echo "  brew install k6"
        return 1
    fi
    
    k6 run - <<EOF
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '1m', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  let res = http.get('${TARGET_URL}/');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
EOF
}

print_results() {
    echo ""
    echo -e "${GREEN}✅ Load test on lõpetatud!${RESET}"
    echo ""
    echo -e "${BLUE}Tulemusi saad vaadata:${RESET}"
    echo "  🎨 Grafana Dashboard: http://localhost:3001/d/containers-cAdvisor"
    echo "  📊 Prometheus Targets: http://localhost:9090/targets"
    echo ""
    echo -e "${BLUE}Jälgi:${RESET}"
    echo "  • CPU graafik peaks tõusma"
    echo "  • Mälu kasutus peaks tõusma"
    echo "  • Telegrami rühm peaks saama häiret (kui seadistatud)"
    echo ""
}

# Main
print_header
print_usage

echo -e "${BLUE}Seadistused:${RESET}"
echo "  URL: $TARGET_URL"
echo "  Test tüüp: $TEST_TYPE"
echo ""

# Kontrolli Apache Benchmark'i
if [ "$TEST_TYPE" != "spike" ]; then
    if ! command -v ab &> /dev/null; then
        echo -e "${RED}❌ Apache Benchmark (ab) pole installitud!${RESET}"
        echo -e "${YELLOW}Paigalda:${RESET}"
        echo "  macOS: brew install httpd"
        echo "  Linux: sudo apt-get install apache2-utils"
        exit 1
    fi
fi

# Käivita test vastavalt tüübile
case "$TEST_TYPE" in
    light)
        test_light
        ;;
    medium)
        test_medium
        ;;
    heavy)
        test_heavy
        ;;
    spike)
        test_spike
        ;;
    *)
        echo -e "${RED}❌ Teadmata test tüüp: $TEST_TYPE${RESET}"
        print_usage
        exit 1
        ;;
esac

print_results