package metrics

import (
	"testing"

	"mitf/internal/models"
)

func TestCalculateHealthIndices(t *testing.T) {
	tests := []struct {
		name         string
		events       []models.UnifiedLogEvent
		expectedDhi  float64
		expectedThi  float64
		expectedFhi  float64
		expectedRoi  float64
		expectedCrit int
		expectedWarn int
	}{
		{
			name:         "empty events list (perfect health)",
			events:       []models.UnifiedLogEvent{},
			expectedDhi:  100.0,
			expectedThi:  100.0,
			expectedFhi:  100.0,
			expectedRoi:  0.0,
			expectedCrit: 0,
			expectedWarn: 0,
		},
		{
			name: "cooling warning (thermal index high)",
			events: []models.UnifiedLogEvent{
				{
					Severity:  "WARNING",
					Process:   "SCNMGR/COOLING",
					Subsystem: "cooling",
					Message:   "exposure index for cooling: 85 percent",
				},
			},
			expectedDhi:  99.36, // 100 - 0.08 * 8%
			expectedThi:  95.829,
			expectedFhi:  99.36,
			expectedRoi:  75.0, // cAvoided = 150, cIntervention = 25+50 = 75 -> roi = 75
			expectedCrit: 0,
			expectedWarn: 1,
		},
		{
			name: "severe tube error (critical deduction)",
			events: []models.UnifiedLogEvent{
				{
					Severity:  "SEVERE_ERROR",
					Process:   "SCNMGR/HW",
					Subsystem: "tube",
					Message:   "x-ray tube spit detected",
				},
			},
			expectedDhi:  91.25, // 100 - 0.35 * 25% = 91.25
			expectedThi:  95.845,
			expectedFhi:  91.25,
			expectedRoi:  270.0, // cAvoided = 400, cIntervention = 80+50 = 130 -> roi = 270
			expectedCrit: 1,
			expectedWarn: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dhi, thi, fhi, roi, critCount, warnCount, _ := CalculateHealthIndices(tt.events)

			// Use small delta tolerance for floating point calculations
			const delta = 0.001
			if dhi < tt.expectedDhi-delta || dhi > tt.expectedDhi+delta {
				t.Errorf("expected DHI %v, got %v", tt.expectedDhi, dhi)
			}
			if thi < tt.expectedThi-delta || thi > tt.expectedThi+delta {
				t.Errorf("expected THI %v, got %v", tt.expectedThi, thi)
			}
			if fhi < tt.expectedFhi-delta || fhi > tt.expectedFhi+delta {
				t.Errorf("expected FHI %v, got %v", tt.expectedFhi, fhi)
			}
			if roi < tt.expectedRoi-delta || roi > tt.expectedRoi+delta {
				t.Errorf("expected ROI %v, got %v", tt.expectedRoi, roi)
			}
			if critCount != tt.expectedCrit {
				t.Errorf("expected CriticalCount %d, got %d", tt.expectedCrit, critCount)
			}
			if warnCount != tt.expectedWarn {
				t.Errorf("expected WarningCount %d, got %d", tt.expectedWarn, warnCount)
			}
		})
	}
}

func TestResolveActiveTube(t *testing.T) {
	// Need to initialize TubeConfig manually for testing if file is missing
	TubeConfig = TubeModelsConfig{
		TubeModels: []TubeModel{
			{
				Model:            "Performix 40 Plus LB",
				EolMasMin:        180000000,
				Bearing:          "liquid",
				HousingRefFamily: "2137130-xx",
			},
			{
				Model:            "Performix Pro",
				EolMasMin:        200000000,
				Bearing:          "ball",
				GeSystems:        []string{"LightSpeed VCT"},
			},
		},
	}

	tests := []struct {
		name          string
		events        []models.UnifiedLogEvent
		expectedModel string
	}{
		{
			name:          "Fallback to default",
			events:        []models.UnifiedLogEvent{},
			expectedModel: "Performix 40 Plus LB",
		},
		{
			name: "Match by GE System name",
			events: []models.UnifiedLogEvent{
				{Message: "system initialized LightSpeed VCT scanner"},
			},
			expectedModel: "Performix Pro",
		},
		{
			name: "Match by Housing Ref",
			events: []models.UnifiedLogEvent{
				{Message: "replaced tube housing 2137130"},
			},
			expectedModel: "Performix 40 Plus LB",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ResolveActiveTube(tt.events)
			if result.Model != tt.expectedModel {
				t.Errorf("expected model %s, got %s", tt.expectedModel, result.Model)
			}
		})
	}
}

func TestGetDynamicTubeAlarms(t *testing.T) {
	TubeConfig = TubeModelsConfig{
		TubeModels: []TubeModel{
			{
				Model:     "Performix 40 Plus LB",
				EolMasMin: 100000, // Small value for easy testing
				Bearing:   "liquid",
			},
		},
	}

	tests := []struct {
		name            string
		events          []models.UnifiedLogEvent
		expectedAlarms  int
		expectedHighest string // WARNING or CRITICAL
	}{
		{
			name:           "No alarms",
			events:         []models.UnifiedLogEvent{{Message: "70,000 mAs", Subsystem: "tube"}},
			expectedAlarms: 0,
		},
		{
			name:            "Warning alarm (80%)",
			events:          []models.UnifiedLogEvent{{Message: "85,000 mAs", Subsystem: "tube"}},
			expectedAlarms:  1,
			expectedHighest: "WARNING",
		},
		{
			name:            "Critical alarm (95%)",
			events:          []models.UnifiedLogEvent{{Message: "96,000 mAs", Subsystem: "tube"}},
			expectedAlarms:  2, // triggers WARNING and CRITICAL
			expectedHighest: "CRITICAL",
		},
		{
			name: "Thermal trigger",
			events: []models.UnifiedLogEvent{
				{Message: "thermal event 1", Subsystem: "cooling"},
				{Message: "thermal event 2", Subsystem: "cooling"},
				{Message: "thermal event 3", Subsystem: "cooling"},
				{Message: "thermal event 4", Subsystem: "cooling"},
				{Message: "thermal event 5", Subsystem: "cooling"},
				{Message: "thermal event 6", Subsystem: "cooling"},
				{Message: "thermal event 7", Subsystem: "cooling"},
				{Message: "thermal event 8", Subsystem: "cooling"},
				{Message: "thermal event 9", Subsystem: "cooling"},
				{Message: "thermal event 10", Subsystem: "cooling"},
				{Message: "thermal event 11", Subsystem: "cooling"},
				{Message: "thermal event 12", Subsystem: "cooling"},
				{Message: "thermal event 13", Subsystem: "cooling"},
				{Message: "thermal event 14", Subsystem: "cooling"},
				{Message: "thermal event 15", Subsystem: "cooling"}, // 15 is limit for liquid bearing
			},
			expectedAlarms:  1,
			expectedHighest: "CRITICAL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			alarms := GetDynamicTubeAlarms(tt.events)
			if len(alarms) != tt.expectedAlarms {
				t.Errorf("expected %d alarms, got %d", tt.expectedAlarms, len(alarms))
			}
			if tt.expectedHighest != "" {
				hasExpected := false
				for _, a := range alarms {
					if a.Severity == tt.expectedHighest {
						hasExpected = true
						break
					}
				}
				if !hasExpected {
					t.Errorf("expected to find severity %s but didn't", tt.expectedHighest)
				}
			}
		})
	}
}
