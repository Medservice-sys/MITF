package parser

import (
	"regexp"
	"strconv"
	"strings"
	"time"

	"mitf/internal/models"
)

// LogParser defines the common interface for all GE log parsers
type LogParser interface {
	Parse(lines []string, source string) []models.UnifiedLogEvent
}

// resolveMITFFields maps GE error codes and process info to MITF TSM subsystems and TCE codes
func resolveMITFFields(geCode string, fallbackSubsystem string) (string, string) {
	// 1. Canonical mappings (TCE Taxonomy)
	switch geCode {
	case "230023030":
		return "tube", "MITF.TUBE.ARC_DETECTED"
	case "230023040":
		return "tube", "MITF.TUBE.ROTATION_ERROR"
	case "260122004":
		return "cooling", "MITF.COOLING.FAN_FAULT"
	case "260134609":
		return "table", "MITF.TABLE.UNCOMMANDED_MOTION"
	case "200180011":
		return "console", "MITF.CONSOLE.DOSE_DB_ERROR"
	}

	// 2. Class prefix mappings
	if strings.HasPrefix(geCode, "2300") {
		return "tube", "MITF.TUBE.GENERIC"
	}
	if strings.HasPrefix(geCode, "2601") {
		return "cooling", "MITF.COOLING.GENERIC"
	}

	// Fallback based on process/source subsystem mapping
	sub := fallbackSubsystem
	if sub == "" {
		sub = "console"
	}
	return sub, "MITF." + strings.ToUpper(sub) + ".GENERIC"
}

// GesysParser handles gesys_aurct.log files
type GesysParser struct{}

func (p *GesysParser) Parse(lines []string, source string) []models.UnifiedLogEvent {
	var events []models.UnifiedLogEvent
	var inBlock bool
	var currentEvent *models.UnifiedLogEvent
	var messageLines []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		if strings.HasPrefix(trimmed, "SR") {
			inBlock = true
			currentEvent = &models.UnifiedLogEvent{
				Source:    source,
				Severity:  "INFORMATIONAL",
				Process:   "SYSTEM", // Default if not found
				Subsystem: "console",
				TCECode:   "MITF.CONSOLE.GENERIC",
			}
			messageLines = []string{}
			continue
		}

		if inBlock && strings.HasPrefix(trimmed, "EN") {
			inBlock = false
			if currentEvent != nil {
				currentEvent.Message = cleanMessage(strings.Join(messageLines, "\n"))
				events = append(events, *currentEvent)
			}
			currentEvent = nil
			continue
		}

		if inBlock && currentEvent != nil {
			fields := strings.Fields(trimmed)
			// Lógica de Cabecera: fields[2] == "1"
			if len(fields) >= 10 && len(fields) > 2 && fields[2] == "1" && currentEvent.GECode == "" {
				currentEvent.GECode = fields[8]
				sevCode := fields[9]
				
				// Mapeo de Severidad
				if sevCode == "1" {
					currentEvent.Severity = "WARNING"
				} else if sevCode == "3" || sevCode == "7" {
					currentEvent.Severity = "SEVERE_ERROR"
				} else if sevCode == "4" || sevCode == "6" {
					currentEvent.Severity = "INFORMATIONAL"
				}

				// Resolve Subsystem and TCE Code based on GE Code
				sub, tce := resolveMITFFields(currentEvent.GECode, "console")
				currentEvent.Subsystem = sub
				currentEvent.TCECode = tce

				// Extraer timestamp
				currentEvent.Timestamp = parseTimestamp(trimmed)
				if currentEvent.Timestamp.Year() < 2020 {
					// Extraer formato "Mon Jan 2 15:04:05 2006"
					dateRegex := regexp.MustCompile(`(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4}`)
					dateMatch := dateRegex.FindString(trimmed)
					if dateMatch != "" {
						dateMatch = strings.Join(strings.Fields(dateMatch), " ")
						parsedTime, err := time.Parse("Mon Jan 2 15:04:05 2006", dateMatch)
						if err == nil {
							currentEvent.Timestamp = parsedTime
						}
					}
				}
				
				messageLines = append(messageLines, trimmed)
				continue
			}

			// Host and Process: linea con tabulador
			if strings.Contains(line, "\t") && currentEvent.Host == "" {
				tabFields := strings.Split(line, "\t")
				if len(tabFields) >= 2 {
					currentEvent.Host = strings.TrimSpace(tabFields[0])
					currentEvent.Process = strings.TrimSpace(tabFields[1])
				}
			}

			messageLines = append(messageLines, trimmed)
		}
	}
	return events
}

// ScanMgrParser handles scanmgr logs
type ScanMgrParser struct{}

func (p *ScanMgrParser) Parse(lines []string, source string) []models.UnifiedLogEvent {
	var events []models.UnifiedLogEvent
	filamentRegex := regexp.MustCompile(`filament_mode:(\d+)`)
	viewRegex := regexp.MustCompile(`data view: (\d+)`)
	coolingRegex := regexp.MustCompile(`exposure index for cooling: (\d+)`)

	// Fallback to April 25, 2026 if no timestamp is found in the current chunk
	fallbackTS := time.Date(2026, time.April, 25, 0, 0, 0, 0, time.UTC)
	for _, line := range lines {
		ts := parseTimestamp(line)
		if ts.Year() >= 2020 && ts.Year() < 2030 {
			fallbackTS = ts
			break
		}
	}
	lastTimestamp := fallbackTS

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		lowerLine := strings.ToLower(trimmed)
		severity := "INFORMATIONAL"
		if strings.Contains(lowerLine, "error") || strings.Contains(lowerLine, "fail") {
			severity = "SEVERE_ERROR"
		} else if strings.Contains(lowerLine, "warn") {
			severity = "WARNING"
		}

		process := "SCNMGR"
		subsystem := "gantry"
		tceCode := "MITF.GANTRY.GENERIC"

		if filamentRegex.MatchString(lowerLine) {
			process = "SCNMGR/HW"
			subsystem = "tube"
			tceCode = "MITF.TUBE.FILAMENT_HEAT"
		} else if viewRegex.MatchString(lowerLine) {
			process = "SCNMGR/ACQ"
			subsystem = "das"
			tceCode = "MITF.DAS.ACQUISITION"
		} else if coolingRegex.MatchString(lowerLine) {
			process = "SCNMGR/COOLING"
			subsystem = "cooling"
			tceCode = "MITF.COOLING.TEMPERATURE_INDEX"
		}

		// Extract timestamp
		ts := parseTimestamp(line)
		if ts.Year() < 2020 {
			ts = parseTimestamp(trimmed)
		}

		if ts.Year() >= 2020 && ts.Year() < 2030 {
			lastTimestamp = ts
		} else {
			ts = lastTimestamp
		}

		events = append(events, models.UnifiedLogEvent{
			Timestamp: ts,
			Severity:  severity,
			Process:   process,
			Message:   cleanMessage(line),
			Source:    source,
			Subsystem: subsystem,
			TCECode:   tceCode,
		})
	}
	return events
}

// DeviceParser handles device_eventlog files
type DeviceParser struct{}

func (p *DeviceParser) Parse(lines []string, source string) []models.UnifiedLogEvent {
	var events []models.UnifiedLogEvent
	deviceEventRegex := regexp.MustCompile(`^([+-])(\w+)\((.*)\)`)

	// Fallback to April 25, 2026 if no timestamp is found in the current chunk
	fallbackTS := time.Date(2026, time.April, 25, 0, 0, 0, 0, time.UTC)
	for _, line := range lines {
		ts := parseTimestamp(line)
		if ts.Year() >= 2020 && ts.Year() < 2030 {
			fallbackTS = ts
			break
		}
	}
	lastTimestamp := fallbackTS

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		// Extract timestamp
		ts := parseTimestamp(line)
		if ts.Year() < 2020 {
			ts = parseTimestamp(trimmed)
		}

		if ts.Year() >= 2020 && ts.Year() < 2030 {
			lastTimestamp = ts
		} else {
			ts = lastTimestamp
		}

		matches := deviceEventRegex.FindStringSubmatch(trimmed)
		msg := trimmed
		subsystem := "gantry"
		tceCode := "MITF.GANTRY.GENERIC"

		if len(matches) == 4 {
			symbol := matches[1]
			event := matches[2]
			details := matches[3]
			msg = "Event: " + event + " | Action: " + symbol + " | Details: " + details
			
			if event == "GantryRotated" {
				subsystem = "gantry"
				tceCode = "MITF.GANTRY.ROTATION_SUCCESS"
			}
		}

		events = append(events, models.UnifiedLogEvent{
			Timestamp: ts,
			Severity:  "INFORMATIONAL",
			Process:   "DEVICE_EVENT",
			Message:   cleanMessage(msg),
			Source:    source,
			Subsystem: subsystem,
			TCECode:   tceCode,
		})
	}
	return events
}

// ReconParser handles recon logs
type ReconParser struct{}

func (p *ReconParser) Parse(lines []string, source string) []models.UnifiedLogEvent {
	var events []models.UnifiedLogEvent

	// Fallback to April 25, 2026 if no timestamp is found in the current chunk
	fallbackTS := time.Date(2026, time.April, 25, 0, 0, 0, 0, time.UTC)
	for _, line := range lines {
		ts := parseTimestamp(line)
		if ts.Year() >= 2020 && ts.Year() < 2030 {
			fallbackTS = ts
			break
		}
	}
	lastTimestamp := fallbackTS

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		lowerLine := strings.ToLower(trimmed)
		severity := "INFORMATIONAL"
		if strings.Contains(lowerLine, "error") || strings.Contains(lowerLine, "failed read") {
			severity = "SEVERE_ERROR"
		} else if strings.Contains(lowerLine, "warn") {
			severity = "WARNING"
		}

		process := "RECON"
		subsystem := "obc"
		tceCode := "MITF.OBC.RECON_EVENT"

		if strings.Contains(lowerLine, "scratchpad") {
			process = "RECON/FS"
			subsystem = "obc"
			tceCode = "MITF.OBC.SCRATCHPAD_ERROR"
		}

		// Extract timestamp
		ts := parseTimestamp(line)
		if ts.Year() < 2020 {
			ts = parseTimestamp(trimmed)
		}

		if ts.Year() >= 2020 && ts.Year() < 2030 {
			lastTimestamp = ts
		} else {
			ts = lastTimestamp
		}

		events = append(events, models.UnifiedLogEvent{
			Timestamp: ts,
			Severity:  severity,
			Process:   process,
			Message:   cleanMessage(line),
			Source:    source,
			Subsystem: subsystem,
			TCECode:   tceCode,
		})
	}
	return events
}

// SysStateParser handles sysstate.log files
type SysStateParser struct{}

func (p *SysStateParser) Parse(lines []string, source string) []models.UnifiedLogEvent {
	var events []models.UnifiedLogEvent
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		if strings.Contains(trimmed, "Operation started") || strings.Contains(trimmed, "Operation completed") {
			parts := strings.SplitN(trimmed, ":", 2)
			ts := time.Now()
			
			if len(parts) == 2 {
				dateStr := strings.TrimSpace(parts[1])
				dateStr = strings.Join(strings.Fields(dateStr), " ")
				parsedTime, err := time.Parse("Mon Jan 2 15:04:05 2006", dateStr)
				if err == nil {
					ts = parsedTime
				}
			}

			events = append(events, models.UnifiedLogEvent{
				Timestamp: ts,
				Severity:  "INFORMATIONAL",
				Process:   "SYSSTATE",
				Message:   cleanMessage(trimmed),
				Source:    source,
				Subsystem: "console",
				TCECode:   "MITF.CONSOLE.SYSSTATE",
			})
		}
	}
	return events
}

// Helper function to check if a string starts with a GE CT binary prefix
func isBinaryPrefix(s string) bool {
	if len(s) < 12 {
		return false
	}
	for i := 0; i < 12; i++ {
		b := s[i]
		if (b < 32 || b > 126) && b != '\n' && b != '\r' && b != '\t' {
			return true
		}
	}
	return false
}

// Helper function to extract timestamp from GE log line (text or binary little-endian uint32 prefix)
func parseTimestamp(line string) time.Time {
	// 1. Try to extract from text MSC_TRACE
	mscRegex := regexp.MustCompile(`MSC_TRACE:(\d+):`)
	mscMatches := mscRegex.FindStringSubmatch(line)
	if len(mscMatches) > 1 {
		sec, err := strconv.ParseInt(mscMatches[1], 10, 64)
		if err == nil {
			return time.Unix(sec, 0)
		}
	}

	// 2. Try to extract from binary little-endian uint32 prefix (common in GE CT binary logs)
	if isBinaryPrefix(line) {
		val := uint32(line[0]) | uint32(line[1])<<8 | uint32(line[2])<<16 | uint32(line[3])<<24
		if val >= 1700000000 && val <= 1900000000 {
			return time.Unix(int64(val), 0)
		}
	}

	return time.Time{}
}

// Helper function to clean binary prefix and non-printable bytes from log messages
func cleanMessage(msg string) string {
	// Strip binary prefix if it exists
	if isBinaryPrefix(msg) {
		msg = msg[12:]
	}
	
	// Clean non-printable characters
	var sb strings.Builder
	for _, r := range msg {
		if (r >= 32 && r <= 126) || r == '\n' || r == '\t' {
			sb.WriteRune(r)
		}
	}
	return strings.TrimSpace(sb.String())
}
