package api

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"os"
	"regexp"
	"strings"
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
		Model:         "GE LightSpeed CT (Legacy)",
		SWVersion:     "v1.2.4-service",
		SerialNumber:  "GE-CT-8218-X",
	},
}

// Global configurations and custom classification rules
var (
	OperationMode          = "online" // "online" or "service"
	OperationModeMu        sync.RWMutex
	CustomClassifications   = make(map[string]string)
	CustomClassificationsMu sync.RWMutex
	DeviceProfiles          = make([]models.DeviceProfile, 0)
	DeviceProfilesMu        sync.RWMutex
	GlobalRefreshSec        = 15
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
	loadClassificationsOnStartup()
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
		
		// Injected Siemens Service Info & Error logs
		siemensInfo1 := models.UnifiedLogEvent{
			Timestamp: now.Add(-6 * time.Minute),
			Severity:  "INFO",
			Subsystem: "gantry",
			Process:   "sysstate.log",
			TCECode:   "MITF.SYSTEM.INFO",
			Message:   "Siemens Somatom Definition AS startup completed successfully",
			Host:      "Siemens-MRI-Serv",
		}
		siemensInfo2 := models.UnifiedLogEvent{
			Timestamp: now.Add(-6 * time.Minute),
			Severity:  "INFO",
			Subsystem: "gantry",
			Process:   "sysstate.log",
			TCECode:   "MITF.SYSTEM.INFO",
			Message:   "System Software version: V5.2.1-service, Serial Number: SN-SIEMENS-98765",
			Host:      "Siemens-MRI-Serv",
		}
		siemensEv := models.UnifiedLogEvent{
			Timestamp: now.Add(-5 * time.Minute),
			Severity:  "CRITICAL",
			Subsystem: "gantry",
			Process:   "sysstate.log",
			TCECode:   "MITF.GANTRY.ROTOR_LOCK_FAILURE",
			Message:   "Siemens SysState: Rotor lock failed to engage during rotation test (error 0x4821)",
			Host:      "Siemens-MRI-Serv",
		}
		
		// Injected Philips Service Info & Error logs
		philipsInfo := models.UnifiedLogEvent{
			Timestamp: now.Add(-11 * time.Minute),
			Severity:  "INFO",
			Subsystem: "tube",
			Process:   "csdErrorLog",
			TCECode:   "MITF.SYSTEM.INFO",
			Message:   "Philips Brilliance 64 system online, software release: 4.1.2, S/N: SN-PHILIPS-12345",
			Host:      "Philips-Achieva",
		}
		philipsEv := models.UnifiedLogEvent{
			Timestamp: now.Add(-10 * time.Minute),
			Severity:  "WARNING",
			Subsystem: "tube",
			Process:   "csdErrorLog",
			TCECode:   "MITF.TUBE.TEMP_INDEX",
			Message:   "Philips csdErrorLog: Anode temperature warning (72.1 C)",
			Host:      "Philips-Achieva",
		}

		events = append(events, siemensInfo1, siemensInfo2, siemensEv, philipsInfo, philipsEv)
	}

	// Inject dynamic tube warning/critical alarms based on specs (mAs/thermal limits)
	dynamicAlarms := metrics.GetDynamicTubeAlarms(events)
	events = append(events, dynamicAlarms...)

	// Update YANG tree and system details dynamically from current events
	UpdateYANGTreeFromEvents(events)

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

// UpdateYANGTreeFromEvents dynamically parses log events to detect scanner type, sw version, and serial number
func UpdateYANGTreeFromEvents(events []models.UnifiedLogEvent) {
	if len(events) == 0 {
		return
	}

	modelRegexes := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:product|model|system|equipment)(?:\s+name|\s+type)?\s*[:=]\s*([a-zA-Z0-9\s_\-\(\)]+)`),
		regexp.MustCompile(`(?i)\b(lightspeed\s*(?:vct|16|ultra|pro|plus|rt)?|optima\s*(?:ct\d+|ct\s*\d+|\d+)?|revolution\s*(?:evo|maxima|apex|\d+)?|brightspeed\s*(?:16|elite|select)?|discovery\s*(?:ct\d+|\d+)?)\b`),
		regexp.MustCompile(`(?i)\b(somatom\s*(?:definition|sensation|emotion|go\s*fit|go\s*now|definition\s*as|force|drive)?)\b`),
		regexp.MustCompile(`(?i)\b(brilliance\s*(?:16|64|ict)?|ingenuity\s*(?:ct)?|spectral\s*(?:ct)?|access\s*(?:ct)?)\b`),
		regexp.MustCompile(`(?i)\b(aquilion\s*(?:one|prime|cxl|lightning|rx|cx)?)\b`),
	}

	swRegexes := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:software\s+version|sw\s+version|sw\s+rev|release|version)\s*[:=]\s*([a-zA-Z0-9\.\-_]+)`),
		regexp.MustCompile(`(?i)\b(?:sw|v|ver|version|release)\s*[:=]?\s*(\d+\.\d+\.\d+(?:-[a-zA-Z0-9\.]+)?)\b`),
	}

	snRegexes := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(?:serial\s*number|system\s*serial|serial\s*no|s/n|sn)\s*[:=]\s*([a-zA-Z0-9\-_]+)`),
	}

	isBlacklisted := func(val string) bool {
		v := strings.ToLower(strings.TrimSpace(val))
		return v == "ios" || v == "unix" || v == "linux" || v == "none" || v == "unknown" || v == "null" || v == "false" || v == "true" || v == "test" || v == "testing"
	}

	var detectedModel, detectedSW, detectedSN string

	// Iterate in reverse chronological order (newest first) to prioritize the latest valid scanner configuration
	for i := len(events) - 1; i >= 0; i-- {
		ev := events[i]

		// Skip display manager log events for hardware identification (generic Java UI properties)
		// and mock injected events (Siemens-MRI-Serv, Philips-Achieva)
		if ev.Process == "DISP_MGR" || 
			strings.Contains(strings.ToLower(ev.Source), "displaymanager") ||
			ev.Host == "Siemens-MRI-Serv" || 
			ev.Host == "Philips-Achieva" {
			continue
		}

		// Search event message
		msg := ev.Message
		if msg == "" {
			continue
		}

		// 1. Check for specific PRODUCT CONFIGURATION line format in GE logs
		if strings.Contains(msg, "PRODUCT CONFIGURATION|") {
			parts := strings.Split(msg, "|")
			for _, part := range parts {
				kv := strings.SplitN(part, ":", 2)
				if len(kv) == 2 {
					key := strings.TrimSpace(kv[0])
					val := strings.TrimSpace(kv[1])
					if key == "Product" && detectedModel == "" && !isBlacklisted(val) {
						if !strings.HasPrefix(strings.ToUpper(val), "GE") {
							detectedModel = "GE " + val
						} else {
							detectedModel = val
						}
					} else if key == "sw_version" && detectedSW == "" && !isBlacklisted(val) {
						detectedSW = val
					} else if key == "host_id" && detectedSN == "" && !isBlacklisted(val) {
						detectedSN = val
					}
				}
			}
		}

		// Also look at hostname for hints
		if ev.Host != "" && ev.Host != "host_test" && ev.Host != "localhost" && ev.Host != "127.0.0.1" {
			// If hostname matches a model keyword, use it as fallback
			if detectedModel == "" {
				for _, r := range modelRegexes {
					if m := r.FindString(ev.Host); m != "" {
						detectedModel = m
						break
					}
				}
			}
			// Hostname might be serial number if it has a pattern like GE-CT-xxxx
			if detectedSN == "" && strings.HasPrefix(strings.ToUpper(ev.Host), "GE-") {
				detectedSN = ev.Host
			}
		}

		// 2. Fallback to regex searches
		// Try to find model
		if detectedModel == "" {
			for _, r := range modelRegexes {
				if matches := r.FindStringSubmatch(msg); len(matches) > 1 {
					val := strings.TrimSpace(matches[1])
					if val != "" && !strings.Contains(strings.ToLower(val), "error") && !isBlacklisted(val) {
						lowerVal := strings.ToLower(val)
						if strings.Contains(lowerVal, "somatom") || strings.Contains(lowerVal, "brilliance") || strings.Contains(lowerVal, "aquilion") {
							detectedModel = val
						} else if !strings.HasPrefix(strings.ToUpper(val), "GE") {
							detectedModel = "GE " + val
						} else {
							detectedModel = val
						}
						break
					}
				}
			}
		}

		// Try to find software version
		if detectedSW == "" {
			for _, r := range swRegexes {
				if matches := r.FindStringSubmatch(msg); len(matches) > 1 {
					val := strings.TrimSpace(matches[1])
					if val != "" && !isBlacklisted(val) {
						detectedSW = val
						break
					}
				}
			}
		}

		// Try to find serial number
		if detectedSN == "" {
			for _, r := range snRegexes {
				if matches := r.FindStringSubmatch(msg); len(matches) > 1 {
					val := strings.TrimSpace(matches[1])
					if val != "" && !isBlacklisted(val) {
						detectedSN = val
						break
					}
				}
			}
		}

		// If we found all three, we can stop early
		if detectedModel != "" && detectedSW != "" && detectedSN != "" {
			break
		}
	}

	Store.mu.Lock()
	defer Store.mu.Unlock()

	// Update Status values
	if detectedModel != "" {
		Store.Status.Model = detectedModel
	}
	if detectedSW != "" {
		Store.Status.SWVersion = detectedSW
	}
	if detectedSN != "" {
		Store.Status.SerialNumber = detectedSN
	}

	if Store.YANGTree == nil {
		return
	}

	// Find the identification node
	var idNode *models.YangNode
	for _, child := range Store.YANGTree.Children {
		if child.Name == "identification" {
			idNode = child
			break
		}
	}

	if idNode != nil {
		for _, leaf := range idNode.Children {
			if leaf.Name == "model" && detectedModel != "" {
				leaf.Value = detectedModel
			}
			if leaf.Name == "sw-version" && detectedSW != "" {
				leaf.Value = detectedSW
			}
			if leaf.Name == "serial-number" && detectedSN != "" {
				leaf.Value = detectedSN
			}
		}
	}
}
