package models

import "time"

// UnifiedLogEvent represents a parsed log event compatible with the dashboard.
type UnifiedLogEvent struct {
	Timestamp   time.Time `json:"timestamp"`
	Severity    string    `json:"severity"`  // "SEVERE_ERROR", "WARNING", "INFORMATIONAL"
	Process     string    `json:"process"`
	Host        string    `json:"host,omitempty"`
	Message     string    `json:"message"`
	GECode      string    `json:"geCode,omitempty"`
	RepeatCount int       `json:"repeatCount,omitempty"`
	Source      string    `json:"source"`
	Subsystem   string    `json:"subsystem,omitempty"` // TSM canonical subsystem
	TCECode     string    `json:"tceCode,omitempty"`   // MITF canonical event code
	ID          string    `json:"id,omitempty"`        // Unique event ID (A-xxxx)
	TicketID    string    `json:"ticketId,omitempty"`  // Linked ticket ID if any
	TicketStatus string   `json:"ticketStatus,omitempty"` // Linked ticket status if any
	DeviceID    string    `json:"deviceId,omitempty"`  // Originating device ID
}

// YangNode represents a hierarchical tree structure for YANG configuration.
type YangNode struct {
	Name     string      `json:"name"`
	Value    interface{} `json:"value,omitempty"`
	Type     string      `json:"type"` // "container", "list", "leaf"
	Children []*YangNode `json:"children,omitempty"`
}

// GlobalMetrics contains overall aggregated system metrics.
type GlobalMetrics struct {
	TotalEvents         int            `json:"totalEvents"`
	CriticalCount       int            `json:"criticalCount"`
	WarningCount        int            `json:"warningCount"`
	PatientsToday       int            `json:"patientsToday"`
	DHI                 float64        `json:"dhi"` // Device Health Index
	THI                 float64        `json:"thi"` // Tube Health Index
	FHI                 float64        `json:"fhi"` // Fleet Health Index
	ROI                 float64        `json:"roi"` // Return on Investment indicator
	SeverityActivity    []int          `json:"severityActivity"`
	EventsByHour        map[string]int `json:"eventsByHour"`
	ProcessCounts       map[string]int `json:"processCounts"`
	ActiveTubeModel     string         `json:"activeTubeModel,omitempty"`
	ActiveTubeBearing   string         `json:"activeTubeBearing,omitempty"`
	ActiveTubeInsertRef string         `json:"activeTubeInsertRef,omitempty"`
	ActiveTubeHousing   string         `json:"activeTubeHousing,omitempty"`
	ActiveTubeEolMasMin float64        `json:"activeTubeEolMasMin,omitempty"`
	ActiveTubeEolMasMax float64        `json:"activeTubeEolMasMax,omitempty"`
	TubeWearPercent     float64        `json:"tubeWearPercent,omitempty"`
}

// CollectorStatus represents the current state of the SSH log collector.
type CollectorStatus struct {
	Status        string    `json:"status"` // "CONNECTED", "DISCONNECTED", "ERROR"
	LastError     string    `json:"lastError"`
	LastCheckTime time.Time `json:"lastCheckTime"`
	Model         string    `json:"model,omitempty"`
	SWVersion     string    `json:"swVersion,omitempty"`
	SerialNumber  string    `json:"serialNumber,omitempty"`
}

// DeviceProfile represents a monitored network element (NE) / equipment profile
type DeviceProfile struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Host         string `json:"host"`
	User         string `json:"user"`
	Password     string `json:"password"`
	Brand        string `json:"brand"`        // "GE", "Philips", "Siemens", "Toshiba", "Hitachi"
	RemoteLogDir string `json:"remoteLogDir"`
	SSHMode      string `json:"sshMode"`      // "modern" or "legacy"
	Active       bool   `json:"active"`
}

// User represents a system user with authentication credentials and an access control role.
type User struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`     // "admin", "operator", "engineer"
	FullName string `json:"fullName"`
	DeviceID string `json:"deviceId,omitempty"` // Linked monitored device, empty means all
}
