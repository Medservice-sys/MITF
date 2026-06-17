package api

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"os"
	"sync"
	"time"

	"mitf/internal/metrics"
	"mitf/internal/models"
)

type SafeStore struct {
	mu           sync.RWMutex
	Events       []models.UnifiedLogEvent
	Status       models.CollectorStatus
	YANGTree     *models.YangNode
	CurrentTimer int
}

var Store = &SafeStore{
	Events: make([]models.UnifiedLogEvent, 0),
	Status: models.CollectorStatus{
		Status:        "DISCONNECTED",
		LastError:     "No connection attempted yet",
		LastCheckTime: time.Now(),
	},
}

// Global configurations and custom classification rules
var (
	OperationMode          = "online" // "online" or "service"
	OperationModeMu        sync.RWMutex
	CustomClassifications   = make(map[string]string)
	CustomClassificationsMu sync.RWMutex
)

func init() {
	// Initialize YANG tree
	Store.YANGTree = &models.YangNode{
		Name: "ge-ct-device",
		Type: "container",
		Children: []*models.YangNode{
			{
				Name: "identification",
				Type: "container",
				Children: []*models.YangNode{
					{Name: "model", Type: "leaf", Value: "GE LightSpeed CT (Legacy)"},
					{Name: "sw-version", Type: "leaf", Value: "v1.2.4-service"},
					{Name: "serial-number", Type: "leaf", Value: "GE-CT-8218-X"},
				},
			},
			{
				Name: "subsystems",
				Type: "container",
				Children: []*models.YangNode{
					{
						Name: "tube",
						Type: "container",
						Children: []*models.YangNode{
							{Name: "filament-current", Type: "leaf", Value: "4.25 A"},
							{Name: "target-angle", Type: "leaf", Value: "7.0 deg"},
							{Name: "accumulated-mas", Type: "leaf", Value: "482310 mAs"},
							{Name: "temperature-celsius", Type: "leaf", Value: 68.4},
						},
					},
					{
						Name: "gantry",
						Type: "container",
						Children: []*models.YangNode{
							{Name: "rotation-speed", Type: "leaf", Value: "120 rpm"},
							{Name: "tilt-angle", Type: "leaf", Value: "0.0 deg"},
							{Name: "rotor-lock-status", Type: "leaf", Value: "UNLOCKED"},
						},
					},
					{
						Name: "detector",
						Type: "container",
						Children: []*models.YangNode{
							{Name: "temperature", Type: "leaf", Value: "37.5 C"},
							{Name: "das-gain-factor", Type: "leaf", Value: 1.025},
							{Name: "active-channels", Type: "leaf", Value: 64},
						},
					},
				},
			},
		},
	}

	// Create data directory and load configurations
	_ = os.MkdirAll("data", 0755)
	loadConfigOnStartup()
	loadClassificationsOnStartup()
}

func loadConfigOnStartup() {
	OperationModeMu.Lock()
	defer OperationModeMu.Unlock()

	file, err := os.ReadFile("data/config.json")
	if err != nil {
		// Default config
		OperationMode = "online"
		return
	}

	var cfg struct {
		OperationMode string `json:"operationMode"`
	}
	if err := json.Unmarshal(file, &cfg); err == nil && cfg.OperationMode != "" {
		OperationMode = cfg.OperationMode
	}
}

func loadClassificationsOnStartup() {
	CustomClassificationsMu.Lock()
	defer CustomClassificationsMu.Unlock()

	file, err := os.ReadFile("data/alarm_classifications.json")
	if err != nil {
		// Populate some defaults
		CustomClassifications = map[string]string{
			"MITF.TUBE.TEMP_INDEX":             "WARNING",
			"MITF.COLLIMATOR.POSITION_ABORT":   "CRITICAL",
			"Svc_Notepad":                      "IGNORE", // Ignore notepad service logs
			"MITF.COOLING.FLUID_FLOW_ABORT":    "CRITICAL",
		}
		saveClassifications()
		return
	}

	_ = json.Unmarshal(file, &CustomClassifications)
}

func saveClassifications() {
	data, _ := json.MarshalIndent(CustomClassifications, "", "  ")
	_ = os.WriteFile("data/alarm_classifications.json", data, 0644)
}

// getProcessedEvents returns thread-safe filtered/mapped events based on custom admin rules
func getProcessedEvents() []models.UnifiedLogEvent {
	Store.mu.RLock()
	// Create a copy of the events
	events := make([]models.UnifiedLogEvent, len(Store.Events))
	copy(events, Store.Events)
	Store.mu.RUnlock()

	// If in Service Mode, inject Siemens/Philips service mock logs
	OperationModeMu.RLock()
	mode := OperationMode
	OperationModeMu.RUnlock()

	if mode == "service" {
		now := time.Now()
		
		// Injected Siemens Service Log
		siemensEv := models.UnifiedLogEvent{
			Timestamp: now.Add(-5 * time.Minute),
			Severity:  "CRITICAL",
			Subsystem: "gantry",
			Process:   "sysstate.log",
			TCECode:   "MITF.GANTRY.ROTOR_LOCK_FAILURE",
			Message:   "Siemens SysState: Rotor lock failed to engage during rotation test (error 0x4821)",
			Host:      "Siemens-MRI-Serv",
		}
		
		// Injected Philips Service Log
		philipsEv := models.UnifiedLogEvent{
			Timestamp: now.Add(-10 * time.Minute),
			Severity:  "WARNING",
			Subsystem: "tube",
			Process:   "csdErrorLog",
			TCECode:   "MITF.TUBE.TEMP_INDEX",
			Message:   "Philips csdErrorLog: Anode temperature warning (72.1 C)",
			Host:      "Philips-Achieva",
		}

		events = append(events, siemensEv, philipsEv)
	}

	// Inject dynamic tube warning/critical alarms based on specs (mAs/thermal limits)
	dynamicAlarms := metrics.GetDynamicTubeAlarms(events)
	events = append(events, dynamicAlarms...)

	CustomClassificationsMu.RLock()
	defer CustomClassificationsMu.RUnlock()

	var result []models.UnifiedLogEvent
	for _, ev := range events {
		// Match against TCECode or Process
		var override string
		if ev.TCECode != "" {
			if o, ok := CustomClassifications[ev.TCECode]; ok {
				override = o
			}
		}
		if override == "" && ev.Process != "" {
			if o, ok := CustomClassifications[ev.Process]; ok {
				override = o
			}
		}

		if override == "IGNORE" || override == "EXCLUDE" {
			continue // Exclude/Ignore this event completely!
		}
		if override != "" {
			ev.Severity = override // Override the severity level!
		}

		// Generate unique ID
		h := md5.New()
		h.Write([]byte(ev.Timestamp.Format(time.RFC3339)))
		h.Write([]byte(ev.TCECode))
		h.Write([]byte(ev.Message))
		ev.ID = "A-" + hex.EncodeToString(h.Sum(nil))[:8]

		// Check if event is linked to any ticket
		maintMu.RLock()
		for _, tk := range ticketRecords {
			for _, entity := range tk.RelatedEntity {
				if entity.ID == ev.ID {
					ev.TicketID = tk.ID
					ev.TicketStatus = tk.Status
					break
				}
			}
			if ev.TicketID != "" {
				break
			}
		}
		maintMu.RUnlock()

		result = append(result, ev)
	}

	return result
}
