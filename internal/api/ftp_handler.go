package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mitf/internal/ftp"
	"mitf/internal/models"
	"mitf/internal/parser"
)

type FTPFile struct {
	Name     string    `json:"name"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

type FTPStatusResponse struct {
	Running   bool   `json:"running"`
	Port      int    `json:"port"`
	User      string `json:"user"`
	Password  string `json:"password"`
	FileCount int    `json:"fileCount"`
}

var ftpMu sync.Mutex

// HandleFTPStatus returns the status of the FTP server
func HandleFTPStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	ftpDir := "data/ftp_logs"
	files, err := os.ReadDir(ftpDir)
	fileCount := 0
	if err == nil {
		for _, f := range files {
			if !f.IsDir() && f.Name() != "archive" {
				fileCount++
			}
		}
	}

	resp := FTPStatusResponse{
		Running:   true,
		Port:      FTPPort,
		User:      FTPUser,
		Password:  FTPPass,
		FileCount: fileCount,
	}

	json.NewEncoder(w).Encode(resp)
}

// HandleFTPFiles returns list of files in the ftp incoming directory
func HandleFTPFiles(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	ftpDir := "data/ftp_logs"
	_ = os.MkdirAll(ftpDir, 0755)

	files, err := os.ReadDir(ftpDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var ftpFiles []FTPFile
	for _, f := range files {
		if f.IsDir() || f.Name() == "archive" {
			continue
		}
		info, err := f.Info()
		if err != nil {
			continue
		}
		ftpFiles = append(ftpFiles, FTPFile{
			Name:     f.Name(),
			Size:     info.Size(),
			Modified: info.ModTime(),
		})
	}

	// Avoid null response, send empty array instead
	if ftpFiles == nil {
		ftpFiles = []FTPFile{}
	}

	json.NewEncoder(w).Encode(ftpFiles)
}

// HandleFTPProcess manually triggers log processing from the FTP directory
func HandleFTPProcess(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	count, err := ProcessFTPLogs()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"processedCount": count,
	})
}

// ProcessFTPLogs reads, parses and archives all files in the incoming FTP folder.
func ProcessFTPLogs() (int, error) {
	ftpMu.Lock()
	defer ftpMu.Unlock()

	ftpDir := "data/ftp_logs"
	archiveDir := filepath.Join(ftpDir, "archive")
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create archive directory: %w", err)
	}

	files, err := os.ReadDir(ftpDir)
	if err != nil {
		return 0, fmt.Errorf("failed to read FTP directory: %w", err)
	}

	totalProcessed := 0
	totalNewEvents := 0
	var newEventsBatch []models.UnifiedLogEvent

	for _, f := range files {
		if f.IsDir() || f.Name() == "archive" {
			continue
		}

		filePath := filepath.Join(ftpDir, f.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			log.Printf("[FTP PROCESS] Error reading file %s: %v", f.Name(), err)
			continue
		}

		rawLines := strings.Split(string(data), "\n")
		var cleanLines []string
		for _, l := range rawLines {
			line := strings.TrimRight(l, "\r")
			if line != "" {
				cleanLines = append(cleanLines, line)
			}
		}

		var p parser.LogParser

		if strings.Contains(f.Name(), "gesys_aurct") {
			p = &parser.GesysParser{}
		} else if strings.Contains(f.Name(), "scanmgr") {
			p = &parser.ScanMgrParser{}
		} else if strings.Contains(f.Name(), "device_eventlog") {
			p = &parser.DeviceParser{}
		} else if strings.Contains(f.Name(), "recon") {
			p = &parser.ReconParser{}
		} else if strings.Contains(f.Name(), "sysstate") {
			p = &parser.SysStateParser{}
		} else if strings.Contains(f.Name(), "displayManager") {
			p = &parser.DisplayManagerParser{}
		} else if strings.Contains(f.Name(), "csdError") {
			p = &parser.CsdErrorParser{}
		} else if strings.Contains(f.Name(), "ssw.dastool.hist") {
			p = &parser.DasToolHistParser{}
		} else {
			log.Printf("[FTP PROCESS] No parser found for file %s, skipping", f.Name())
			continue
		}

		newEvents := p.Parse(cleanLines, f.Name())
		if len(newEvents) > 0 {
			newEventsBatch = append(newEventsBatch, newEvents...)
			totalNewEvents += len(newEvents)
		}

		// Move to archive
		destPath := filepath.Join(archiveDir, fmt.Sprintf("%d_%s", time.Now().Unix(), f.Name()))
		if err := os.Rename(filePath, destPath); err != nil {
			log.Printf("[FTP PROCESS] Error moving file %s to archive: %v", f.Name(), err)
			if dataCopyErr := os.WriteFile(destPath, data, 0644); dataCopyErr == nil {
				os.Remove(filePath)
			}
		}

		totalProcessed++
	}

	if totalNewEvents > 0 {
		Store.mu.Lock()
		Store.Events = append(Store.Events, newEventsBatch...)
		if len(Store.Events) > 500000 {
			Store.Events = Store.Events[len(Store.Events)-500000:]
		}
		eventsCopy := make([]models.UnifiedLogEvent, len(Store.Events))
		copy(eventsCopy, Store.Events)
		Store.mu.Unlock()

		UpdateYANGTreeFromEvents(eventsCopy)
		log.Printf("[FTP PROCESS] Parsed and added %d new events from FTP files. Total events in memory: %d", totalNewEvents, len(eventsCopy))
	}

	return totalProcessed, nil
}

// StartFTPWatcher starts a background worker that regularly processes uploaded logs
func StartFTPWatcher() {
	log.Printf("[FTP WATCHER] Starting background FTP log watcher (interval: 10s)...")
	go func() {
		for {
			time.Sleep(10 * time.Second)
			count, err := ProcessFTPLogs()
			if err != nil {
				log.Printf("[FTP WATCHER] Error processing FTP logs: %v", err)
			} else if count > 0 {
				log.Printf("[FTP WATCHER] Automatically processed %d logs from FTP", count)
			}
		}
	}()
}

// HandleFTPConfig handles updating the FTP configuration and restarting the FTP server
func HandleFTPConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Port     int    `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Port < 1024 || req.Port > 65535 {
		http.Error(w, "Invalid port number (must be between 1024 and 65535)", http.StatusBadRequest)
		return
	}

	if req.User == "" || req.Password == "" {
		http.Error(w, "Username and password cannot be empty", http.StatusBadRequest)
		return
	}

	// Save to DB
	if err := SaveFTPConfigToDB(req.Port, req.User, req.Password); err != nil {
		http.Error(w, "Failed to save FTP configuration: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Restart FTP server dynamically
	ftp.StartFTPServer(req.Port, req.User, req.Password)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "saved",
		"port":     req.Port,
		"user":     req.User,
		"password": req.Password,
	})
}
