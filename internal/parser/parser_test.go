package parser

import (
	"testing"
	"time"

	"mitf/internal/models"
)

func TestGesysParser(t *testing.T) {
	parser := &GesysParser{}
	
	tests := []struct {
		name     string
		lines    []string
		expected int
		verify   func(t *testing.T, events []models.UnifiedLogEvent)
	}{
		{
			name: "valid gesys block",
			lines: []string{
				"SR ",
				"col0 col1 1 col3 col4 col5 col6 col7 GECODE_123 3 Mon Jun 7 04:37:34 2026",
				"host_test\tprocess_test",
				"Sample message line 1",
				"Sample message line 2",
				"EN ",
			},
			expected: 1,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				ev := events[0]
				if ev.Severity != "SEVERE_ERROR" {
					t.Errorf("expected SEVERE_ERROR, got %s", ev.Severity)
				}
				if ev.GECode != "GECODE_123" {
					t.Errorf("expected GECODE_123, got %s", ev.GECode)
				}
				if ev.Host != "host_test" {
					t.Errorf("expected host_test, got %s", ev.Host)
				}
				if ev.Process != "process_test" {
					t.Errorf("expected process_test, got %s", ev.Process)
				}
				expectedMsg := "col0 col1 1 col3 col4 col5 col6 col7 GECODE_123 3 Mon Jun 7 04:37:34 2026\nhost_test\tprocess_test\nSample message line 1\nSample message line 2"
				if ev.Message != expectedMsg {
					t.Errorf("expected message %q, got %q", expectedMsg, ev.Message)
				}
			},
		},
		{
			name: "malformed block missing EN",
			lines: []string{
				"SR ",
				"123 456 1 789 Mon Jun 7 04:37:34 2026 GECODE_999 1",
				"host_test\tprocess_test",
				"Message...",
			},
			expected: 0,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				// No events since EN is missing
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			events := parser.Parse(tt.lines, "gesys_aurct.log")
			if len(events) != tt.expected {
				t.Fatalf("expected %d events, got %d", tt.expected, len(events))
			}
			if tt.expected > 0 {
				tt.verify(t, events)
			}
		})
	}
}

func TestScanMgrParser(t *testing.T) {
	parser := &ScanMgrParser{}

	tests := []struct {
		name     string
		lines    []string
		expected int
		verify   func(t *testing.T, events []models.UnifiedLogEvent)
	}{
		{
			name: "filament mode log",
			lines: []string{
				"filament_mode:2 heating up",
			},
			expected: 1,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				ev := events[0]
				if ev.Process != "SCNMGR/HW" {
					t.Errorf("expected SCNMGR/HW, got %s", ev.Process)
				}
				if ev.Severity != "INFORMATIONAL" {
					t.Errorf("expected INFORMATIONAL, got %s", ev.Severity)
				}
			},
		},
		{
			name: "exposure cooling index log with warning",
			lines: []string{
				"WARN: exposure index for cooling: 85 percent",
			},
			expected: 1,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				ev := events[0]
				if ev.Process != "SCNMGR/COOLING" {
					t.Errorf("expected SCNMGR/COOLING, got %s", ev.Process)
				}
				if ev.Severity != "WARNING" {
					t.Errorf("expected WARNING, got %s", ev.Severity)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			events := parser.Parse(tt.lines, "scanmgr.log")
			if len(events) != tt.expected {
				t.Fatalf("expected %d events, got %d", tt.expected, len(events))
			}
			if tt.expected > 0 {
				tt.verify(t, events)
			}
		})
	}
}

func TestDeviceParser(t *testing.T) {
	parser := &DeviceParser{}

	tests := []struct {
		name     string
		lines    []string
		expected int
		verify   func(t *testing.T, events []models.UnifiedLogEvent)
	}{
		{
			name: "matching device log",
			lines: []string{
				"+GantryRotated(speed=120,tilt=0)",
			},
			expected: 1,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				ev := events[0]
				expectedMsg := "Event: GantryRotated | Action: + | Details: speed=120,tilt=0"
				if ev.Message != expectedMsg {
					t.Errorf("expected message %q, got %q", expectedMsg, ev.Message)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			events := parser.Parse(tt.lines, "device_eventlog")
			if len(events) != tt.expected {
				t.Fatalf("expected %d events, got %d", tt.expected, len(events))
			}
			if tt.expected > 0 {
				tt.verify(t, events)
			}
		})
	}
}

func TestReconParser(t *testing.T) {
	parser := &ReconParser{}

	tests := []struct {
		name     string
		lines    []string
		expected int
		verify   func(t *testing.T, events []models.UnifiedLogEvent)
	}{
		{
			name: "recon scratchpad log with error",
			lines: []string{
				"failed read scratchpad config",
			},
			expected: 1,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				ev := events[0]
				if ev.Process != "RECON/FS" {
					t.Errorf("expected RECON/FS, got %s", ev.Process)
				}
				if ev.Severity != "SEVERE_ERROR" {
					t.Errorf("expected SEVERE_ERROR, got %s", ev.Severity)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			events := parser.Parse(tt.lines, "recon.log")
			if len(events) != tt.expected {
				t.Fatalf("expected %d events, got %d", tt.expected, len(events))
			}
			if tt.expected > 0 {
				tt.verify(t, events)
			}
		})
	}
}

func TestSysStateParser(t *testing.T) {
	parser := &SysStateParser{}

	tests := []struct {
		name     string
		lines    []string
		expected int
		verify   func(t *testing.T, events []models.UnifiedLogEvent)
	}{
		{
			name: "operation completed log with date",
			lines: []string{
				"Operation completed: Mon Jun 7 04:37:34 2026",
			},
			expected: 1,
			verify: func(t *testing.T, events []models.UnifiedLogEvent) {
				ev := events[0]
				if ev.Process != "SYSSTATE" {
					t.Errorf("expected SYSSTATE, got %s", ev.Process)
				}
				expectedTime, _ := time.Parse("Mon Jan 2 15:04:05 2006", "Mon Jun 7 04:37:34 2026")
				if !ev.Timestamp.Equal(expectedTime) {
					t.Errorf("expected timestamp %v, got %v", expectedTime, ev.Timestamp)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			events := parser.Parse(tt.lines, "sysstate.log")
			if len(events) != tt.expected {
				t.Fatalf("expected %d events, got %d", tt.expected, len(events))
			}
			if tt.expected > 0 {
				tt.verify(t, events)
			}
		})
	}
}
