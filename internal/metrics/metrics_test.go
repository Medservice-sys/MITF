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
