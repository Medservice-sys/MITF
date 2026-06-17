package main

import (
	"fmt"
	"log"
	"net/http"

	"mitf/internal/api"
	"mitf/internal/config"
)

func main() {
	// Load environment variables centrally
	if err := config.LoadConfig(); err != nil {
		log.Fatalf("CRITICAL STARTUP ERROR: %v", err)
	}

	// 1. Start background SSH poller engine
	api.StartPollingEngine()

	// 2. Define HTTP route handlers
	http.HandleFunc("/api/data", api.HandleData)
	http.HandleFunc("/api/metrics", api.HandleMetrics)
	http.HandleFunc("/api/status", api.HandleStatus)
	http.HandleFunc("/api/yang", api.HandleYang)
	http.HandleFunc("/api/history", api.HandleHistory)
	http.HandleFunc("/api/classification", api.HandleClassification)

	// Canonical MITF endpoints
	http.HandleFunc("/api/devices", api.HandleDevices)
	http.HandleFunc("/api/subsystems", api.HandleSubsystems)
	http.HandleFunc("/api/events", api.HandleData) // mapped to HandleData
	http.HandleFunc("/api/health", api.HandleHealth)
	http.HandleFunc("/api/fleet", api.HandleFleet)
	http.HandleFunc("/api/dashboard", api.HandleDashboard)

	// New MITF features endpoints
	http.HandleFunc("/api/admin/classifications", api.HandleAdminClassifications)
	http.HandleFunc("/api/admin/catalog", api.HandleAdminCatalog)
	http.HandleFunc("/api/admin/health-config", api.HandleAdminHealthConfig)
	http.HandleFunc("/api/admin/tube-models", api.HandleAdminTubeModels)
	http.HandleFunc("/api/config", api.HandleConfig)
	http.HandleFunc("/api/maintenance/records", api.HandleMaintenanceRecords)
	http.HandleFunc("/troubleTicketManagement/v4/troubleTicket", api.HandleTroubleTicket)
	http.HandleFunc("/api/knowledge", api.HandleKnowledge)
	http.HandleFunc("/api/dicom/stations", api.HandleDicomStations)
	http.HandleFunc("/api/dicom/ping", api.HandleDicomPing)

	// 3. Serve frontend static assets from public folder
	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)

	port := config.AppConfig.ServerPort
	fmt.Printf("MITF-TOM Monitor running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
