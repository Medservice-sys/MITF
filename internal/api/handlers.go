package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"mitf/internal/metrics"
	"mitf/internal/models"
)

// HandleData returns all log events with severity & process filters
func HandleData(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	severity := r.URL.Query().Get("severity")
	process := r.URL.Query().Get("process")

	events := getProcessedEvents()
	fromTime, toTime, hasRange := parseDateRange(r, events)

	var filtered []models.UnifiedLogEvent
	for _, ev := range events {
		if hasRange && !fromTime.IsZero() && ev.Timestamp.Before(fromTime) {
			continue
		}
		if hasRange && !toTime.IsZero() && ev.Timestamp.After(toTime) {
			continue
		}
		if severity != "" && ev.Severity != severity {
			continue
		}
		if process != "" && !strings.Contains(strings.ToLower(ev.Process), strings.ToLower(process)) {
			continue
		}
		filtered = append(filtered, ev)
	}

	// Reverse to get latest first
	if filtered == nil {
		filtered = make([]models.UnifiedLogEvent, 0)
	}
	for i, j := 0, len(filtered)-1; i < j; i, j = i+1, j-1 {
		filtered[i], filtered[j] = filtered[j], filtered[i]
	}

	// Limit to latest 5000 events to prevent browser lag and OOM
	const maxLogsToReturn = 5000
	if len(filtered) > maxLogsToReturn {
		filtered = filtered[:maxLogsToReturn]
	}

	json.NewEncoder(w).Encode(filtered)
}

// HandleMetrics calculates and returns dashboard KPIs and chart data
func HandleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()
	fromTime, toTime, hasRange := parseDateRange(r, events)

	var filtered []models.UnifiedLogEvent
	for _, ev := range events {
		if hasRange && !fromTime.IsZero() && ev.Timestamp.Before(fromTime) {
			continue
		}
		if hasRange && !toTime.IsZero() && ev.Timestamp.After(toTime) {
			continue
		}
		filtered = append(filtered, ev)
	}

	dhi, thi, fhi, roi, critCount, warnCount, processMap := metrics.CalculateHealthIndices(filtered)

	activeTube := metrics.ResolveActiveTube(filtered)
	cumulativeMAs := 7478990.0 // Baseline default count
	reMAs := regexp.MustCompile(`([\d,]+)\s*mAs`)
	for _, ev := range filtered {
		if ev.Subsystem == "tube" {
			if strings.Contains(ev.Message, "mAs") {
				matches := reMAs.FindStringSubmatch(ev.Message)
				if len(matches) > 1 {
					cleanVal := strings.ReplaceAll(matches[1], ",", "")
					if val, err := strconv.ParseFloat(cleanVal, 64); err == nil {
						if val > cumulativeMAs {
							cumulativeMAs = val
						}
					}
				}
			}
		}
	}
	var wearPercent float64
	if activeTube.EolMasMin > 0 {
		wearPercent = (cumulativeMAs / activeTube.EolMasMin) * 100.0
	}

	eventsByHour := make(map[string]int)
	for _, ev := range filtered {
		// Agrupar por hora ("YYYY-MM-DD HH:00")
		hourKey := ev.Timestamp.Format("2006-01-02 15:00")
		eventsByHour[hourKey]++
	}

	metricsData := models.GlobalMetrics{
		TotalEvents:         len(filtered),
		CriticalCount:       critCount,
		WarningCount:        warnCount,
		PatientsToday:       0,
		DHI:                 dhi,
		THI:                 thi,
		FHI:                 fhi,
		ROI:                 roi,
		SeverityActivity:    []int{len(filtered)}, // Legacy field
		EventsByHour:        eventsByHour,
		ProcessCounts:       processMap,
		ActiveTubeModel:     activeTube.Model,
		ActiveTubeBearing:   activeTube.Bearing,
		ActiveTubeInsertRef: activeTube.InsertRef,
		ActiveTubeHousing:   activeTube.HousingRefFamily,
		ActiveTubeEolMasMin: activeTube.EolMasMin,
		ActiveTubeEolMasMax: activeTube.EolMasMax,
		TubeWearPercent:     wearPercent,
	}

	json.NewEncoder(w).Encode(metricsData)
}

// HandleStatus returns SSH Connection Health status
func HandleStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	Store.mu.RLock()
	defer Store.mu.RUnlock()

	json.NewEncoder(w).Encode(Store.Status)
}

// HandleYang returns the hierarchical config tree
func HandleYang(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	Store.mu.RLock()
	defer Store.mu.RUnlock()

	json.NewEncoder(w).Encode(Store.YANGTree)
}

// HandleHistory returns all events grouped by log date and hour
func HandleHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	var filteredEvents []models.UnifiedLogEvent
	if fromStr != "" || toStr != "" {
		var fromTime, toTime time.Time
		if fromStr != "" {
			if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
				fromTime = t
			}
		}
		if toStr != "" {
			if t, err := time.Parse(time.RFC3339, toStr); err == nil {
				toTime = t
			}
		}

		for _, ev := range events {
			if !fromTime.IsZero() && ev.Timestamp.Before(fromTime) {
				continue
			}
			if !toTime.IsZero() && ev.Timestamp.After(toTime) {
				continue
			}
			filteredEvents = append(filteredEvents, ev)
		}
	} else {
		// Copy slice to avoid mutating global store order if sorted in-place
		filteredEvents = make([]models.UnifiedLogEvent, len(events))
		copy(filteredEvents, events)
	}

	// Sort events descending (newest first)
	sort.Slice(filteredEvents, func(i, j int) bool {
		return filteredEvents[i].Timestamp.After(filteredEvents[j].Timestamp)
	})

	// Slice to latest 5000 events to prevent browser crash and memory overhead
	const maxHistoryEvents = 5000
	if len(filteredEvents) > maxHistoryEvents {
		filteredEvents = filteredEvents[:maxHistoryEvents]
	}

	grouped := make(map[string][]models.UnifiedLogEvent)
	for _, ev := range filteredEvents {
		// Group by date and hour (YYYY-MM-DD HH:00)
		dateStr := ev.Timestamp.Format("2006-01-02 15:00")
		grouped[dateStr] = append(grouped[dateStr], ev)
	}

	json.NewEncoder(w).Encode(grouped)
}

// HandleDevices returns the list of active medical devices
func HandleDevices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	hosts := make(map[string]bool)
	for _, ev := range events {
		if ev.Host != "" {
			hosts[ev.Host] = true
		}
	}

	type DeviceInfo struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}

	var list []DeviceInfo
	for h := range hosts {
		list = append(list, DeviceInfo{ID: h, Status: "ONLINE"})
	}
	if len(list) == 0 {
		list = append(list, DeviceInfo{ID: "GE-CT-8218-X", Status: "ONLINE"})
	}

	json.NewEncoder(w).Encode(list)
}

// HandleSubsystems returns TSM subsystems and their health status
func HandleSubsystems(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	subsystems := []string{
		"tube", "hv_generator", "das", "gantry", "collimator",
		"tgp", "obc", "rcib", "table", "cooling", "console",
	}

	shiDegradation := make(map[string]float64)
	for _, ev := range events {
		sub := strings.ToLower(ev.Subsystem)
		if sub == "" {
			sub = "console"
		}
		weight := 0.01
		if ev.Severity == "SEVERE_ERROR" {
			weight = 0.25
		} else if ev.Severity == "WARNING" {
			weight = 0.08
		}
		shiDegradation[sub] += weight
	}

	type SubsystemInfo struct {
		Name   string  `json:"name"`
		Health float64 `json:"health"`
		Status string  `json:"status"`
	}

	var list []SubsystemInfo
	for _, sub := range subsystems {
		rSub := shiDegradation[sub]
		if rSub > 1.0 {
			rSub = 1.0
		}
		health := 100.0 * (1.0 - rSub)

		status := "NORMAL"
		if health < 25.0 {
			status = "CRÍTICO"
		} else if health < 50.0 {
			status = "ALERTA"
		} else if health < 75.0 {
			status = "DEGRADANDO"
		}

		list = append(list, SubsystemInfo{
			Name:   sub,
			Health: health,
			Status: status,
		})
	}

	json.NewEncoder(w).Encode(list)
}

// HandleHealth returns current device and tube quantitative health indices
func HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	dhi, thi, fhi, roi, _, _, _ := metrics.CalculateHealthIndices(events)

	type HealthResponse struct {
		DHI float64 `json:"dhi"`
		THI float64 `json:"thi"`
		FHI float64 `json:"fhi"`
		ROI float64 `json:"roi"`
	}

	json.NewEncoder(w).Encode(HealthResponse{
		DHI: dhi,
		THI: thi,
		FHI: fhi,
		ROI: roi,
	})
}

// HandleFleet returns fleet-wide metrics (FHI)
func HandleFleet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	dhi, thi, fhi, roi, crit, warn, _ := metrics.CalculateHealthIndices(events)

	type FleetResponse struct {
		FHI           float64 `json:"fhi"`
		TotalDevices  int     `json:"totalDevices"`
		CriticalCount int     `json:"criticalCount"`
		WarningCount  int     `json:"warningCount"`
		DHI           float64 `json:"dhi"`
		THI           float64 `json:"thi"`
		ROI           float64 `json:"roi"`
	}

	json.NewEncoder(w).Encode(FleetResponse{
		FHI:           fhi,
		TotalDevices:  1,
		CriticalCount: crit,
		WarningCount:  warn,
		DHI:           dhi,
		THI:           thi,
		ROI:           roi,
	})
}

// HandleDashboard returns aggregated dataset for the main visual panel
func HandleDashboard(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()
	Store.mu.RLock()
	status := Store.Status
	Store.mu.RUnlock()

	dhi, thi, fhi, roi, crit, warn, processMap := metrics.CalculateHealthIndices(events)

	validCount := 0
	for _, ev := range events {
		if ev.TCECode != "" && !strings.Contains(ev.TCECode, "GENERIC") {
			validCount++
		}
	}
	dqs := 100.0
	if len(events) > 0 {
		dqs = (float64(validCount) / float64(len(events))) * 100.0
	}

	type DashboardResponse struct {
		FHI           float64           `json:"fhi"`
		DHI           float64           `json:"dhi"`
		THI           float64           `json:"thi"`
		ROI           float64           `json:"roi"`
		DQS           float64           `json:"dqs"`
		TotalEvents   int               `json:"totalEvents"`
		CriticalCount int               `json:"criticalCount"`
		WarningCount  int               `json:"warningCount"`
		Collector     string            `json:"collectorStatus"`
		ProcessCounts map[string]int    `json:"processCounts"`
		RecentEvents  []models.UnifiedLogEvent `json:"recentEvents"`
	}

	recent := events
	if len(recent) > 10 {
		recent = recent[len(recent)-10:]
	}

	json.NewEncoder(w).Encode(DashboardResponse{
		FHI:           fhi,
		DHI:           dhi,
		THI:           thi,
		ROI:           roi,
		DQS:           dqs,
		TotalEvents:   len(events),
		CriticalCount: crit,
		WarningCount:  warn,
		Collector:     status.Status,
		ProcessCounts: processMap,
		RecentEvents:  recent,
	})
}

// HandleClassification processes, filters, and groups logs for alerts, hardware, network, temperature, and aborted scans.
func HandleClassification(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	fromTime, toTime, hasRange := parseDateRange(r, events)
	var filteredEvents []models.UnifiedLogEvent
	if hasRange {
		for _, ev := range events {
			if !fromTime.IsZero() && ev.Timestamp.Before(fromTime) {
				continue
			}
			if !toTime.IsZero() && ev.Timestamp.After(toTime) {
				continue
			}
			filteredEvents = append(filteredEvents, ev)
		}
	} else {
		filteredEvents = events
	}

	// 1. Alertas Tempranas (Severity is SEVERE_ERROR or WARNING within last 24 hours of latest log)
	var latestTime time.Time
	for _, ev := range filteredEvents {
		if ev.Timestamp.After(latestTime) {
			latestTime = ev.Timestamp
		}
	}
	if latestTime.IsZero() {
		latestTime = time.Now()
	}
	cutoff := latestTime.Add(-24 * time.Hour)

	alerts := []models.UnifiedLogEvent{}
	for _, ev := range filteredEvents {
		sev := strings.ToUpper(ev.Severity)
		if (sev == "SEVERE_ERROR" || sev == "WARNING" || sev == "CRITICAL") && ev.Timestamp.After(cutoff) {
			alerts = append(alerts, ev)
		}
	}

	// 2. Hardware: from gesys_aurct.log and dataacq.* where Subsystem is Tube, Detector, DAS, Gantry
	hardware := []models.UnifiedLogEvent{}
	for _, ev := range filteredEvents {
		src := strings.ToLower(ev.Source)
		sub := strings.ToLower(ev.Subsystem)
		isGeseysOrAcq := strings.Contains(src, "gesys_aurct") || strings.Contains(src, "dataacq")
		isHwSubsystem := sub == "tube" || sub == "detector" || sub == "das" || sub == "gantry"
		if isGeseysOrAcq && isHwSubsystem {
			hardware = append(hardware, ev)
		}
	}

	// 3. DICOM / Red: from gesys_aurct.log where Subsystem is Network or DICOM and message has network errors
	dicom := []models.UnifiedLogEvent{}
	for _, ev := range filteredEvents {
		src := strings.ToLower(ev.Source)
		sub := strings.ToLower(ev.Subsystem)
		isGesys := strings.Contains(src, "gesys_aurct")
		isNetSub := sub == "network" || sub == "dicom"
		if isGesys && isNetSub {
			msg := strings.ToLower(ev.Message)
			if strings.Contains(msg, "pushed failed") || strings.Contains(msg, "connection timeout") ||
				strings.Contains(msg, "fail") || strings.Contains(msg, "timeout") || strings.Contains(msg, "pacs") {
				dicom = append(dicom, ev)
			}
		}
	}

	// 4. Calentamientos: specifically Tube events with temperature-related errors
	maintenance := []models.UnifiedLogEvent{}
	for _, ev := range filteredEvents {
		sub := strings.ToLower(ev.Subsystem)
		if sub == "tube" {
			msg := strings.ToLower(ev.Message)
			if strings.Contains(msg, "overheat") || strings.Contains(msg, "cooling delay") ||
				strings.Contains(msg, "temp") || strings.Contains(msg, "thermal") ||
				strings.Contains(msg, "hot") || strings.Contains(msg, "heat") || strings.Contains(msg, "heating") {
				maintenance = append(maintenance, ev)
			}
		}
	}

	// 5. Fallas Agrupadas: from scanmgr.* ending in Aborted or Failed grouped by day
	stops := make(map[string]int)
	for _, ev := range filteredEvents {
		src := strings.ToLower(ev.Source)
		if strings.Contains(src, "scanmgr") {
			msg := strings.ToLower(ev.Message)
			if strings.Contains(msg, "abort") || strings.Contains(msg, "fail") || strings.Contains(msg, "stop") {
				dayStr := ev.Timestamp.Format("2006-01-02")
				stops[dayStr]++
			}
		}
	}

	// 6. Compute Hardware summary metrics dynamically from the events list
	var exposureCount int64
	var revsCount int64
	var maxTemp float64
	var latestRevs int64
	var cumulativeMAs float64

	reTemp := regexp.MustCompile(`(?:cooling:\s*(\d+)|(\d+(\.\d+)?)\s*°C)`)
	reRevs := regexp.MustCompile(`Total No\. of Gantry Revolutions\s*:\s*(\d+)`)
	reMAs := regexp.MustCompile(`([\d,]+)\s*mAs`)

	for _, ev := range filteredEvents {
		// mAs Accumulation count (exposures)
		if ev.Subsystem == "das" || ev.Process == "SCNMGR/ACQ" || ev.TCECode == "MITF.DAS.ACQUISITION" || ev.Process == "SCNMGR/COOLING" || ev.TCECode == "MITF.COOLING.TEMPERATURE_INDEX" {
			exposureCount++
		}
		if ev.Subsystem == "tube" {
			if strings.Contains(ev.Message, "mAs") {
				matches := reMAs.FindStringSubmatch(ev.Message)
				if len(matches) > 1 {
					cleanVal := strings.ReplaceAll(matches[1], ",", "")
					if val, err := strconv.ParseFloat(cleanVal, 64); err == nil {
						if val > cumulativeMAs {
							cumulativeMAs = val
						}
					}
				}
			}
		}
		// Rotations count
		if ev.Subsystem == "gantry" && (ev.TCECode == "MITF.GANTRY.ROTATION_SUCCESS" || strings.Contains(strings.ToLower(ev.Message), "rotated") || strings.Contains(strings.ToLower(ev.Message), "revolutions")) {
			revsCount++
		}
		matchesRevs := reRevs.FindStringSubmatch(ev.Message)
		if len(matchesRevs) > 1 {
			if val, err := strconv.ParseInt(matchesRevs[1], 10, 64); err == nil {
				if val > latestRevs {
					latestRevs = val
				}
			}
		}
		// Temperature
		if ev.Subsystem == "cooling" || ev.Process == "SCNMGR/COOLING" || ev.Subsystem == "tube" {
			matches := reTemp.FindStringSubmatch(ev.Message)
			if len(matches) > 1 {
				valStr := matches[1]
				if valStr == "" && len(matches) > 2 {
					valStr = matches[2]
				}
				if val, err := strconv.ParseFloat(valStr, 64); err == nil {
					if val > maxTemp {
						maxTemp = val
					}
				}
			}
		}
	}

	// Map metrics to physical values (each exposure is approx 3000 mAs, each rotation event is 50 rotations)
	totalMas := exposureCount * 3000
	if cumulativeMAs > 0 {
		totalMas = int64(cumulativeMAs)
	}

	activeTube := metrics.ResolveActiveTube(filteredEvents)
	var wearPercent float64
	if activeTube.EolMasMin > 0 {
		wearPercent = (float64(totalMas) / activeTube.EolMasMin) * 100.0
	}
	totalRevs := revsCount * 50
	if latestRevs > 0 {
		totalRevs = latestRevs
	}
	// If no temperature was found but we have events, default to 24.0 °C (ambient baseline)
	if maxTemp == 0.0 && len(filteredEvents) > 0 {
		maxTemp = 24.0
	}

	activeDateStr := ""
	if hasRange && !fromTime.IsZero() {
		activeDateStr = fromTime.Format("2006-01-02")
	}

	resp := struct {
		AlertsCount         int                      `json:"alertsCount"`
		Alerts              []models.UnifiedLogEvent `json:"alerts"`
		Hardware            []models.UnifiedLogEvent `json:"hardware"`
		Dicom               []models.UnifiedLogEvent `json:"dicom"`
		Maintenance         []models.UnifiedLogEvent `json:"maintenance"`
		Stops               map[string]int           `json:"stops"`
		TotalMas            int64                    `json:"totalMas"`
		TotalRevs           int64                    `json:"totalRevs"`
		MaxTemp             float64                  `json:"maxTemp"`
		ActiveDate          string                   `json:"activeDate"`
		ActiveTubeModel     string                   `json:"activeTubeModel"`
		ActiveTubeBearing   string                   `json:"activeTubeBearing"`
		ActiveTubeInsertRef string                   `json:"activeTubeInsertRef"`
		ActiveTubeHousing   string                   `json:"activeTubeHousing"`
		ActiveTubeEolMasMin float64                  `json:"activeTubeEolMasMin"`
		ActiveTubeEolMasMax float64                  `json:"activeTubeEolMasMax"`
		TubeWearPercent     float64                  `json:"tubeWearPercent"`
	}{
		AlertsCount:         len(alerts),
		Alerts:              alerts,
		Hardware:            hardware,
		Dicom:               dicom,
		Maintenance:         maintenance,
		Stops:               stops,
		TotalMas:            totalMas,
		TotalRevs:           totalRevs,
		MaxTemp:             maxTemp,
		ActiveDate:          activeDateStr,
		ActiveTubeModel:     activeTube.Model,
		ActiveTubeBearing:   activeTube.Bearing,
		ActiveTubeInsertRef: activeTube.InsertRef,
		ActiveTubeHousing:   activeTube.HousingRefFamily,
		ActiveTubeEolMasMin: activeTube.EolMasMin,
		ActiveTubeEolMasMax: activeTube.EolMasMax,
		TubeWearPercent:     wearPercent,
	}

	json.NewEncoder(w).Encode(resp)
}
