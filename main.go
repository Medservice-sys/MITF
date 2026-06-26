package main

import (
	"fmt"
	"log"
	"net/http"

	"mitf/internal/api"
	"mitf/internal/config"
	"mitf/internal/db"
	"mitf/internal/ftp"
)

func main() {
	// Load environment variables centrally
	if err := config.LoadConfig(); err != nil {
		log.Fatalf("CRITICAL STARTUP ERROR: %v", err)
	}

	// Initialize database connection
	db.InitDB()

	// Load or migrate general configuration and device profiles from PostgreSQL
	api.LoadConfigOnStartup()
	api.LoadDevicesOnStartup()
	api.LoadUsersOnStartup()

	// Start embedded FTP server for CT Logs (Fallback when SSH is off)
	ftp.StartFTPServer(api.FTPPort, api.FTPUser, api.FTPPass)

	// Start FTP watcher to auto-process uploaded logs
	api.StartFTPWatcher()

	// 1. Start background SSH poller engine
	api.StartPollingEngine()

	// 2. Define HTTP route handlers
	http.HandleFunc("/api/data", api.HandleData)
	http.HandleFunc("/api/metrics", api.HandleMetrics)
	http.HandleFunc("/api/status", api.HandleStatus)
	http.HandleFunc("/api/yang", api.HandleYang)
	http.HandleFunc("/api/history", api.HandleHistory)
	http.HandleFunc("/api/classification", api.HandleClassification)
	http.HandleFunc("/api/users", api.HandleUsers)
	http.HandleFunc("/api/users/login", api.HandleUsersLogin)

	// Canonical MITF endpoints
	http.HandleFunc("/api/devices", api.HandleDevices)
	http.HandleFunc("/api/devices/ping", api.HandleDevicePing)
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

	// FTP Ingestion Endpoints
	http.HandleFunc("/api/ftp/status", api.HandleFTPStatus)
	http.HandleFunc("/api/ftp/files", api.HandleFTPFiles)
	http.HandleFunc("/api/ftp/process", api.HandleFTPProcess)
	http.HandleFunc("/api/ftp/config", api.HandleFTPConfig)

	// 3. Serve frontend static assets from public folder
	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)

	port := config.AppConfig.ServerPort
	fmt.Printf("MITF-TOM Monitor running on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
