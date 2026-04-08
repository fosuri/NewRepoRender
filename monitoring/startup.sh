#!/bin/bash

# Monitoring Stack Startup Script
# Käivitab kogu monitooringu infrastruktuuri koos tarkuste kontrollimisega

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defines
RESET='\033[0m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BLUE}║   🚀 Monitooringu Stäkk 2026 - Startup Script             ║${RESET}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# Kontrolli Docker'i
echo -e "${YELLOW}[1/5] Docker kontrollimine...${RESET}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker pole installitud!${RESET}"
    exit 1
fi
echo -e "${GREEN}✅ Docker on olemas${RESET}"

# Kontrolli Docker Compose'i
echo -e "${YELLOW}[2/5] Docker Compose kontrollimine...${RESET}"
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose pole installitud!${RESET}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose on olemas${RESET}"

# Käivita konteinerid
echo -e "${YELLOW}[3/5] Monitooringu stäkk käivitamisel...${RESET}"
docker-compose up -d
echo -e "${GREEN}✅ Konteinerid käivitatud${RESET}"

# Oota, et teenused oleksid aktiivsed
echo -e "${YELLOW}[4/5] Ootame, et teenused käiviksid...${RESET}"
sleep 5

# Kontrolli teenuste olekut
echo -e "${YELLOW}[5/5] Teenuste olekut kontrollimist...${RESET}"
echo ""

# Prometheus kontroll
if curl -s http://localhost:9090 > /dev/null; then
    echo -e "${GREEN}✅ Prometheus${RESET} http://localhost:9090"
else
    echo -e "${RED}❌ Prometheus ei reageeri${RESET}"
fi

# Grafana kontroll
if curl -s http://localhost:3001 > /dev/null; then
    echo -e "${GREEN}✅ Grafana${RESET} http://localhost:3001 (admin/admin)"
else
    echo -e "${RED}❌ Grafana ei reageeri${RESET}"
fi

# Node Exporter kontroll
if curl -s http://localhost:9100 > /dev/null; then
    echo -e "${GREEN}✅ Node Exporter${RESET} http://localhost:9100"
else
    echo -e "${RED}❌ Node Exporter ei reageeri${RESET}"
fi

# cAdvisor kontroll
if curl -s http://localhost:8080 > /dev/null; then
    echo -e "${GREEN}✅ cAdvisor${RESET} http://localhost:8080"
else
    echo -e "${RED}❌ cAdvisor ei reageeri${RESET}"
fi

echo ""
echo -e "${GREEN}✅ Monitooringu stäkk on käimas!${RESET}"
echo ""
echo -e "${BLUE}Logisid vaatamiseks:${RESET}"
echo "  docker-compose logs -f prometheus"
echo "  docker-compose logs -f grafana"
echo "  docker-compose logs -f cadvisor"
echo ""
echo -e "${BLUE}Stäkki peatamiseks:${RESET}"
echo "  docker-compose down"
echo ""
echo -e "${BLUE}Edasi lugeda:${RESET}"
echo "  📖 README.md - Ülevaade"
echo "  🚀 QUICK_START.md - Kiire alustamine"
echo "  📚 MONITORING_GUIDE.md - Täielik juhend"
echo ""