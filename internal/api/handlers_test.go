package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"mitf/internal/models"
)

func TestHandleData(t *testing.T) {
	// Seed Store.Events with mock diagnostic data
	Store.mu.Lock()
	t1 := time.Date(2026, 6, 7, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 6, 7, 12, 0, 0, 0, time.UTC)
	Store.Events = []models.UnifiedLogEvent{
		{
			Timestamp: t1,
			Severity:  "WARNING",
			Process:   "scanmgr",
			Message:   "tube heating high warning",
			Subsystem: "tube",
			TCECode:   "MITF.TUBE.GENERIC",
		},
		{
			Timestamp: t2,
			Severity:  "SEVERE_ERROR",
			Process:   "recon",
			Message:   "image reconstruction failure",
			Subsystem: "obc",
			TCECode:   "MITF.OBC.RECON_EVENT",
		},
	}
	Store.mu.Unlock()

	// 1. Test standard response (reversed order)
	req := httptest.NewRequest("GET", "/api/data", nil)
	w := httptest.NewRecorder()
	HandleData(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", resp.StatusCode)
	}

	var results []models.UnifiedLogEvent
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("expected 2 events, got %d", len(results))
	}
	if results[0].Process != "recon" {
		t.Errorf("expected first event to be recon (latest first), got %s", results[0].Process)
	}

	// 2. Test filtering by severity
	req = httptest.NewRequest("GET", "/api/data?severity=WARNING", nil)
	w = httptest.NewRecorder()
	HandleData(w, req)
	var results2 []models.UnifiedLogEvent
	if err := json.NewDecoder(w.Body).Decode(&results2); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(results2) != 1 || results2[0].Severity != "WARNING" {
		t.Errorf("expected 1 WARNING event, got %v", results2)
	}

	// 3. Test filtering by process
	req = httptest.NewRequest("GET", "/api/data?process=recon", nil)
	w = httptest.NewRecorder()
	HandleData(w, req)
	var results3 []models.UnifiedLogEvent
	if err := json.NewDecoder(w.Body).Decode(&results3); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if len(results3) != 1 || results3[0].Process != "recon" {
		t.Errorf("expected 1 recon event, got %v", results3)
	}
}

func TestHandleHistory(t *testing.T) {
	// Seed Store.Events with mock diagnostic data with explicit timestamps
	Store.mu.Lock()
	t1, _ := time.Parse("2006-01-02", "2026-06-07")
	t2, _ := time.Parse("2006-01-02", "2026-06-06")

	Store.Events = []models.UnifiedLogEvent{
		{
			Timestamp: t1.Add(10 * time.Hour),
			Severity:  "WARNING",
			Process:   "scanmgr",
			Message:   "tube heating high warning",
			Subsystem: "tube",
			TCECode:   "MITF.TUBE.GENERIC",
		},
		{
			Timestamp: t1.Add(12 * time.Hour),
			Severity:  "SEVERE_ERROR",
			Process:   "recon",
			Message:   "image reconstruction failure",
			Subsystem: "obc",
			TCECode:   "MITF.OBC.RECON_EVENT",
		},
		{
			Timestamp: t2.Add(8 * time.Hour),
			Severity:  "INFORMATIONAL",
			Process:   "sysstate",
			Message:   "system state checks success",
			Subsystem: "console",
			TCECode:   "MITF.CONSOLE.SYSSTATE",
		},
	}
	Store.mu.Unlock()

	req := httptest.NewRequest("GET", "/api/history", nil)
	w := httptest.NewRecorder()

	HandleHistory(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200 OK, got %d", resp.StatusCode)
	}

	var results map[string][]models.UnifiedLogEvent
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// Verify grouping
	if len(results) != 3 {
		t.Errorf("expected 3 date/hour groups, got %d", len(results))
	}

	if len(results["2026-06-07 10:00"]) != 1 {
		t.Errorf("expected 1 event on 2026-06-07 10:00, got %d", len(results["2026-06-07 10:00"]))
	}

	if len(results["2026-06-07 12:00"]) != 1 {
		t.Errorf("expected 1 event on 2026-06-07 12:00, got %d", len(results["2026-06-07 12:00"]))
	}

	if len(results["2026-06-06 08:00"]) != 1 {
		t.Errorf("expected 1 event on 2026-06-06 08:00, got %d", len(results["2026-06-06 08:00"]))
	}
}

func TestHandleDevices(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/devices", nil)
	w := httptest.NewRecorder()
	HandleDevices(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var devices []map[string]string
	if err := json.NewDecoder(w.Body).Decode(&devices); err != nil {
		t.Fatalf("failed to decode devices response: %v", err)
	}
	if len(devices) == 0 {
		t.Errorf("expected at least one default device, got 0")
	}
}

func TestHandleSubsystems(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/subsystems", nil)
	w := httptest.NewRecorder()
	HandleSubsystems(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var list []map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode subsystems response: %v", err)
	}
	if len(list) != 11 {
		t.Errorf("expected 11 TSM subsystems, got %d", len(list))
	}
}

func TestHandleHealth(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/health", nil)
	w := httptest.NewRecorder()
	HandleHealth(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var health map[string]float64
	if err := json.NewDecoder(w.Body).Decode(&health) ; err != nil {
		t.Fatalf("failed to decode health response: %v", err)
	}
	if _, ok := health["dhi"]; !ok {
		t.Errorf("expected dhi in health response")
	}
	if _, ok := health["thi"]; !ok {
		t.Errorf("expected thi in health response")
	}
}

func TestHandleFleet(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/fleet", nil)
	w := httptest.NewRecorder()
	HandleFleet(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var fleet map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&fleet); err != nil {
		t.Fatalf("failed to decode fleet response: %v", err)
	}
	if _, ok := fleet["fhi"]; !ok {
		t.Errorf("expected fhi in fleet response")
	}
}

func TestHandleDashboard(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/dashboard", nil)
	w := httptest.NewRecorder()
	HandleDashboard(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var dash map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&dash); err != nil {
		t.Fatalf("failed to decode dashboard response: %v", err)
	}
	if _, ok := dash["dqs"]; !ok {
		t.Errorf("expected dqs in dashboard response")
	}
}

func TestHandleClassification(t *testing.T) {
	// Seed events with classification patterns
	Store.mu.Lock()
	now := time.Now()
	Store.Events = []models.UnifiedLogEvent{
		{
			Timestamp: now.Add(-2 * time.Hour),
			Severity:  "WARNING",
			Process:   "scanmgr",
			Message:   "tube heating high warning",
			Subsystem: "tube",
			Source:    "/tmp/mocklogs/scanmgr.stdout.log",
		},
		{
			Timestamp: now.Add(-5 * time.Hour),
			Severity:  "SEVERE_ERROR",
			Process:   "gesys",
			Message:   "Detector temp drift detected",
			Subsystem: "detector",
			Source:    "/tmp/mocklogs/gesys_aurct.log",
		},
		{
			Timestamp: now.Add(-10 * time.Hour),
			Severity:  "INFORMATIONAL",
			Process:   "gesys",
			Message:   "PACS pushed failed connection timeout",
			Subsystem: "DICOM",
			Source:    "/tmp/mocklogs/gesys_aurct.log",
		},
		{
			Timestamp: now.Add(-12 * time.Hour),
			Severity:  "INFORMATIONAL",
			Process:   "scanmgr",
			Message:   "Scan aborted by operator request",
			Subsystem: "console",
			Source:    "/tmp/mocklogs/scanmgr.stdout.log",
		},
		{
			Timestamp: now.Add(-30 * time.Hour), // Older than 24h
			Severity:  "WARNING",
			Process:   "recon",
			Message:   "Old warning out of 24h range",
			Subsystem: "obc",
			Source:    "/tmp/mocklogs/recon_control.stdout.log",
		},
	}
	Store.mu.Unlock()

	fromStr := now.Add(-36 * time.Hour).Format(time.RFC3339)
	toStr := now.Add(1 * time.Hour).Format(time.RFC3339)
	req := httptest.NewRequest("GET", "/api/classification?from="+fromStr+"&to="+toStr, nil)
	w := httptest.NewRecorder()
	HandleClassification(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp struct {
		AlertsCount  int                      `json:"alertsCount"`
		Alerts       []models.UnifiedLogEvent `json:"alerts"`
		Hardware     []models.UnifiedLogEvent `json:"hardware"`
		Dicom        []models.UnifiedLogEvent `json:"dicom"`
		Maintenance  []models.UnifiedLogEvent `json:"maintenance"`
		Stops        map[string]int           `json:"stops"`
		TotalMas     int64                    `json:"totalMas"`
		TotalRevs    int64                    `json:"totalRevs"`
		MaxTemp      float64                  `json:"maxTemp"`
	}

	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	// 1. Alerts count check (should be 2 within 24h, old warning and informational logs excluded)
	if resp.AlertsCount != 2 {
		t.Errorf("expected 2 alerts count, got %d", resp.AlertsCount)
	}

	// 2. Hardware check (gesys and subsystem = detector / scanmgr and subsystem = tube)
	// Wait, scanmgr is not gesys or dataacq, so only gesys detector should be in hardware
	if len(resp.Hardware) != 1 || resp.Hardware[0].Subsystem != "detector" {
		t.Errorf("expected 1 hardware event from detector subsystem, got %v", resp.Hardware)
	}

	// 3. Dicom check (PACS pushed failed from gesys_aurct.log)
	if len(resp.Dicom) != 1 || resp.Dicom[0].Subsystem != "DICOM" {
		t.Errorf("expected 1 dicom event, got %v", resp.Dicom)
	}

	// 4. Maintenance check (tube overheating/cooling related warnings)
	if len(resp.Maintenance) != 1 || resp.Maintenance[0].Subsystem != "tube" {
		t.Errorf("expected 1 maintenance event, got %v", resp.Maintenance)
	}

	// 5. Stops check (aborted or failed scanmgr scans)
	if len(resp.Stops) != 1 {
		t.Errorf("expected 1 stop group date, got %v", resp.Stops)
	}
}
