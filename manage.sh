#!/bin/bash

# MITF-TOM Management Script
# Designed for field technicians moving laptops between locations.

COLOR_RESET="\033[0m"
COLOR_GREEN="\033[1;32m"
COLOR_BLUE="\033[1;34m"
COLOR_YELLOW="\033[1;33m"
COLOR_RED="\033[1;31m"

show_help() {
    echo -e "${COLOR_BLUE}Script de Gestión de Servicios - MITF-TOM Monitor${COLOR_RESET}"
    echo "Uso: ./manage.sh [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo -e "  ${COLOR_GREEN}start${COLOR_RESET}     - Iniciar todos los servicios en segundo plano (Dashboard y Base de Datos)."
    echo -e "  ${COLOR_GREEN}stop${COLOR_RESET}      - Detener todos los servicios y liberar recursos."
    echo -e "  ${COLOR_GREEN}restart${COLOR_RESET}   - Reiniciar los servicios (útil para aplicar cambios en caliente)."
    echo -e "  ${COLOR_GREEN}status${COLOR_RESET}    - Mostrar el estado de los contenedores y verificar conectividad con tomógrafos."
    echo -e "  ${COLOR_GREEN}logs${COLOR_RESET}      - Seguir los logs en tiempo real de la aplicación."
    echo -e "  ${COLOR_GREEN}help${COLOR_RESET}      - Mostrar esta ayuda."
}

check_dependencies() {
    if ! command -v docker &> /dev/null; then
        echo -e "${COLOR_RED}Error: Docker no está instalado en este equipo.${COLOR_RESET}"
        exit 1
    fi
}

start_services() {
    echo -e "${COLOR_BLUE}[+] Iniciando servicios MITF-TOM...${COLOR_RESET}"
    docker compose up -d
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}[✔] Servicios iniciados con éxito.${COLOR_RESET}"
        echo "Abra su navegador en: http://localhost:8081"
    else
        echo -e "${COLOR_RED}[✘] Error al iniciar los servicios.${COLOR_RESET}"
    fi
}

stop_services() {
    echo -e "${COLOR_YELLOW}[-] Deteniendo servicios MITF-TOM...${COLOR_RESET}"
    docker compose down
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}[✔] Servicios detenidos correctamente.${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}[✘] Error al detener los servicios.${COLOR_RESET}"
    fi
}

restart_services() {
    echo -e "${COLOR_BLUE}[+] Reiniciando servicios MITF-TOM...${COLOR_RESET}"
    docker compose restart
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}[✔] Servicios reiniciados con éxito.${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}[✘] Error al reiniciar los servicios.${COLOR_RESET}"
    fi
}

show_status() {
    echo -e "${COLOR_BLUE}[+] Estado de los Contenedores Docker:${COLOR_RESET}"
    docker compose ps
    echo ""
    echo -e "${COLOR_BLUE}[+] Verificando Red y Conectividad con Tomógrafos:${COLOR_RESET}"
    
    # Check IP 192.168.80.80 (GE aurct)
    echo -n "Pingeando Tomógrafo aurct (192.168.80.80)... "
    ping -c 2 -W 2 192.168.80.80 &> /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}EN LÍNEA (OK)${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}FUERA DE LÍNEA (No responde ping)${COLOR_RESET}"
    fi

    # Check IP 192.168.80.10 (GE Cotahuma CT03)
    echo -n "Pingeando Tomógrafo Cotahuma CT03 (192.168.80.10)... "
    ping -c 2 -W 2 192.168.80.10 &> /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${COLOR_GREEN}EN LÍNEA (OK)${COLOR_RESET}"
    else
        echo -e "${COLOR_RED}FUERA DE LÍNEA (No responde ping)${COLOR_RESET}"
    fi
    
    echo ""
    echo "Nota: Si se mueve de un sitio a otro, asegúrese de cambiar el segmento de red de su laptop"
    echo "para estar en el mismo rango (Ej. 192.168.80.X) y pida las IPs correctas del tomógrafo."
}

show_logs() {
    docker compose logs -f --tail=100
}

check_dependencies

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    help|*)
        show_help
        ;;
esac
