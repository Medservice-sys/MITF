package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"mitf/internal/models"
)

// HandleMriMetrics handles GET /api/mri/metrics
func HandleMriMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	events := getProcessedEvents()

	var mriEvents []models.UnifiedLogEvent
	activeTirCount := 0

	for _, ev := range events {
		if strings.EqualFold(ev.Modality, "MRI") || strings.Contains(strings.ToLower(ev.Source), "lx-mr") || strings.Contains(strings.ToLower(ev.Source), "resonador") {
			mriEvents = append(mriEvents, ev)
			if ev.Subsystem == "thermal" || strings.Contains(strings.ToLower(ev.Message), "interlock") {
				if ev.Severity == "WARNING" || ev.Severity == "SEVERE_ERROR" {
					activeTirCount++
				}
			}
		}
	}

	// Default telemetry values based on system_health.log / HART readings
	metrics := models.MRITelemetry{
		HeliumLevelPercent: 78.5,
		MagnetPressure:     4.2,
		MagnetField:        "1.5T LCC",
		MagnetSerial:       "R4290",
		MagnetRampStatus:   "pos",
		GradientRiseTime:   276,
		GradientAmpType:    "HFD Gradients",
		RFAmpType:          "1.5T SRFD2",
		MaxBandwidthkHz:    250.0,
		BoreTempLevel1:     31.0,
		BoreTempLevel2:     36.0,
		ActiveTirInterlocks: activeTirCount,
		MriHealthScore:     98.5,
		HospitalName:       "RadiologyDiagnosticCenter",
		SWRevision:         "12.0_M5B_0846.d",
	}

	if activeTirCount > 0 {
		metrics.MriHealthScore -= float64(activeTirCount * 5)
		if metrics.MriHealthScore < 50 {
			metrics.MriHealthScore = 50
		}
	}

	json.NewEncoder(w).Encode(metrics)
}
