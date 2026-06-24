package metrics

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"mitf/internal/models"
)

type HealthModelConfig struct {
	RatedMAsCapacity  float64            `json:"rated_mas_capacity"`
	KThermal          float64            `json:"k_thermal"`
	NMaxThermal       float64            `json:"n_max_thermal"`
	LambdaDecay       float64            `json:"lambda_decay"`
	Weights           map[string]float64 `json:"weights"`
	Alphas            map[string]float64 `json:"alphas"`
	SelectedTubeModel string             `json:"selected_tube_model,omitempty"`
}

var ActiveConfig = HealthModelConfig{
	RatedMAsCapacity: 100000000.0,
	KThermal:         0.05,
	NMaxThermal:      300.0,
	LambdaDecay:      0.01,
	Weights: map[string]float64{
		"critical": 0.25,
		"major":    0.18,
		"warning":  0.08,
		"info":     0.01,
	},
	Alphas: map[string]float64{
		"tube":         0.35,
		"hv_generator": 0.20,
		"das":          0.15,
		"gantry":       0.12,
		"cooling":      0.08,
		"collimator":   0.04,
		"tgp":          0.02,
		"obc":          0.02,
		"rcib":         0.01,
		"table":        0.01,
		"console":      0.00,
	},
	SelectedTubeModel: "auto",
}

var ConfigMu sync.RWMutex

func init() {
	LoadConfig()
}

func LoadConfig() {
	ConfigMu.Lock()
	defer ConfigMu.Unlock()
	file, err := os.ReadFile("data/health_model_config.json")
	if err == nil {
		_ = json.Unmarshal(file, &ActiveConfig)
	} else {
		// Save defaults
		saveConfigLocked()
	}
}

func SaveConfig(cfg HealthModelConfig) {
	ConfigMu.Lock()
	defer ConfigMu.Unlock()
	ActiveConfig = cfg
	saveConfigLocked()
}

func saveConfigLocked() {
	data, _ := json.MarshalIndent(ActiveConfig, "", "  ")
	_ = os.WriteFile("data/health_model_config.json", data, 0644)
}

func GetConfig() HealthModelConfig {
	ConfigMu.RLock()
	defer ConfigMu.RUnlock()

	// Deep copy maps to prevent concurrent read/write access to references
	copyCfg := ActiveConfig
	copyCfg.Weights = make(map[string]float64)
	for k, v := range ActiveConfig.Weights {
		copyCfg.Weights[k] = v
	}
	copyCfg.Alphas = make(map[string]float64)
	for k, v := range ActiveConfig.Alphas {
		copyCfg.Alphas[k] = v
	}
	return copyCfg
}

type TubeModel struct {
	Model                string   `json:"model"`
	Line                 string   `json:"line"`
	InsertName           string   `json:"insert_name"`
	InsertRef            string   `json:"insert_ref"`
	HousingRefFamily     string   `json:"housing_ref_family"`
	Bearing              string   `json:"bearing"`
	AnodeHeatCapacityMhu float64  `json:"anode_heat_capacity_mhu"`
	MaxKv                float64  `json:"max_kv"`
	EolMasMin            float64  `json:"eol_mas_min"`
	EolMasMax            float64  `json:"eol_mas_max"`
	GeSystems            []string `json:"ge_systems"`
}

type TubeModelsConfig struct {
	SchemaVersion   string             `json:"schema_version"`
	Metric          string             `json:"metric"`
	AlarmThresholds map[string]float64 `json:"alarm_thresholds"`
	TubeModels      []TubeModel        `json:"tube_models"`
}

var (
	TubeConfig     TubeModelsConfig
	TubeConfigMu   sync.Mutex
	TubeConfigOnce sync.Once
)

func LoadTubeModels() {
	TubeConfigMu.Lock()
	defer TubeConfigMu.Unlock()
	file, err := os.ReadFile("data/tube_models.json")
	if err == nil {
		_ = json.Unmarshal(file, &TubeConfig)
	}
}

func ResolveActiveTube(events []models.UnifiedLogEvent) TubeModel {
	TubeConfigOnce.Do(func() {
		LoadTubeModels()
	})

	// 0. Check administrative manual override selection
	ConfigMu.RLock()
	selectedModel := ActiveConfig.SelectedTubeModel
	ConfigMu.RUnlock()

	if selectedModel != "" && selectedModel != "auto" {
		for _, m := range TubeConfig.TubeModels {
			if strings.ToLower(m.Model) == strings.ToLower(selectedModel) {
				return m
			}
		}
	}

	// 1. Dual identification: search events messages for insert_ref or housing_ref_family
	for _, ev := range events {
		msg := ev.Message
		for _, m := range TubeConfig.TubeModels {
			// Search for insert_ref
			if m.InsertRef != "" && strings.Contains(msg, m.InsertRef) {
				return m
			}
			// Search for housing_ref_family (e.g. "2137130")
			if m.HousingRefFamily != "" {
				familyClean := strings.ReplaceAll(m.HousingRefFamily, "-xx", "")
				if strings.Contains(msg, familyClean) {
					return m
				}
			}
		}
	}

	// 2. Fallback to system model compatibility in events (message or host or source)
	for _, ev := range events {
		content := ev.Message + " " + ev.Host + " " + ev.Source
		for _, m := range TubeConfig.TubeModels {
			for _, sys := range m.GeSystems {
				if strings.Contains(strings.ToLower(content), strings.ToLower(sys)) {
					return m
				}
			}
		}
	}

	// 3. Absolute Fallback: default to Performix 40 Plus LB (the standard)
	for _, m := range TubeConfig.TubeModels {
		if m.Model == "Performix 40 Plus LB" {
			return m
		}
	}

	// If somehow not found, return a default empty model with Performix 40 Plus LB parameters
	return TubeModel{
		Model:      "Performix 40 Plus LB",
		EolMasMin:  180000000,
		EolMasMax:  250000000,
		Bearing:    "liquid",
		AnodeHeatCapacityMhu: 6.3,
	}
}

func GetDynamicTubeAlarms(events []models.UnifiedLogEvent) []models.UnifiedLogEvent {
	activeTube := ResolveActiveTube(events)

	// Calculate cumulative mAs and cooling events
	cumulativeMAs := 0.0
	hasTubeMAs := false
	N_thermal := 0.0

	reMAs := regexp.MustCompile(`(?i)([\d,]+)\s*mAs`)
	var latestTime time.Time
	for _, ev := range events {
		if ev.Timestamp.After(latestTime) {
			latestTime = ev.Timestamp
		}
		if ev.Subsystem == "tube" || strings.Contains(strings.ToLower(ev.Message), "mas") {
			if strings.Contains(strings.ToLower(ev.Message), "mas") {
				matches := reMAs.FindStringSubmatch(ev.Message)
				if len(matches) > 1 {
					cleanVal := strings.ReplaceAll(matches[1], ",", "")
					if val, err := strconv.ParseFloat(cleanVal, 64); err == nil {
						hasTubeMAs = true
						if val > cumulativeMAs {
							cumulativeMAs = val
						}
					}
				}
			}
		}
		if ev.Subsystem == "cooling" || strings.Contains(strings.ToLower(ev.Message), "cooling") || strings.Contains(strings.ToLower(ev.Message), "thermal") {
			N_thermal++
		}
	}

	if !hasTubeMAs && len(events) > 0 {
		cumulativeMAs = 7478990.0 // Baseline default count fallback
	}

	if latestTime.IsZero() {
		latestTime = time.Now()
	}

	var alarms []models.UnifiedLogEvent

	// Check L_wear
	var L_wear float64
	if activeTube.EolMasMin > 0 {
		L_wear = cumulativeMAs / activeTube.EolMasMin
	}

	// 1. TUBE_LIFE_WARNING: L_wear >= 0.80
	if L_wear >= 0.80 {
		alarms = append(alarms, models.UnifiedLogEvent{
			Timestamp: latestTime,
			Severity:  "WARNING",
			Process:   "TUBE_MONITOR",
			Subsystem: "tube",
			TCECode:   "TUBE_LIFE_WARNING",
			Message:   fmt.Sprintf("Planificar reemplazo; notificar a servicio. Desgaste del tubo al %.1f%% (EOL mAs min: %.0f).", L_wear*100.0, activeTube.EolMasMin),
			Source:    "internal",
		})
	}

	// 2. TUBE_LIFE_CRITICAL: L_wear >= 0.95
	if L_wear >= 0.95 {
		alarms = append(alarms, models.UnifiedLogEvent{
			Timestamp: latestTime.Add(1 * time.Second), // Ensure sorted after warning if both trigger
			Severity:  "CRITICAL",
			Process:   "TUBE_MONITOR",
			Subsystem: "tube",
			TCECode:   "TUBE_LIFE_CRITICAL",
			Message:   fmt.Sprintf("Reemplazo inminente; alerta crítica. Desgaste del tubo al %.1f%% (EOL mAs min: %.0f).", L_wear*100.0, activeTube.EolMasMin),
			Source:    "internal",
		})
	}

	// 3. TUBE_LIFE_CRITICAL: L_thermal_alert == true (thermal limit exceeded)
	var thermalEventLimit float64
	if activeTube.Bearing == "liquid" {
		thermalEventLimit = 15.0 // LMB has faster warm-up/cool-down
	} else {
		thermalEventLimit = 5.0  // ball bearing has lower tolerance
	}
	L_thermal_alert := N_thermal >= thermalEventLimit

	if L_thermal_alert {
		alarms = append(alarms, models.UnifiedLogEvent{
			Timestamp: latestTime.Add(2 * time.Second),
			Severity:  "CRITICAL",
			Process:   "TUBE_MONITOR",
			Subsystem: "tube",
			TCECode:   "TUBE_LIFE_CRITICAL",
			Message:   fmt.Sprintf("Trigger térmico independiente. Se detectaron %.0f eventos de cooling/thermal superando el umbral del cojinete (%s).", N_thermal, activeTube.Bearing),
			Source:    "internal",
		})
	}

	return alarms
}

// CalculateHealthIndices computes DHI, THI, FHI, ROI based on MITF formulas and weights.
func CalculateHealthIndices(events []models.UnifiedLogEvent) (dhi, thi, fhi, roi float64, critCount, warnCount int, processMap map[string]int) {
	cfg := GetConfig()

	processMap = make(map[string]int)
	now := time.Now()

	// 1. Basic counts
	for _, ev := range events {
		if ev.Severity == "SEVERE_ERROR" || ev.Severity == "CRITICAL" || ev.Severity == "MAJOR_ERROR" {
			critCount++
		} else if ev.Severity == "WARNING" || ev.Severity == "WARN_MINOR" {
			warnCount++
		}
		processMap[ev.Process]++
	}

	// 2. Compute Tube Health Index (THI)
	activeTube := ResolveActiveTube(events)

	cumulativeMAs := 0.0
	hasTubeMAs := false
	N_thermal := 0.0

	reMAs := regexp.MustCompile(`(?i)([\d,]+)\s*mAs`)
	for _, ev := range events {
		if ev.Subsystem == "tube" || strings.Contains(strings.ToLower(ev.Message), "mas") {
			if strings.Contains(strings.ToLower(ev.Message), "mas") {
				matches := reMAs.FindStringSubmatch(ev.Message)
				if len(matches) > 1 {
					cleanVal := strings.ReplaceAll(matches[1], ",", "")
					if val, err := strconv.ParseFloat(cleanVal, 64); err == nil {
						hasTubeMAs = true
						if val > cumulativeMAs {
							cumulativeMAs = val
						}
					}
				}
			}
		}
		if ev.Subsystem == "cooling" || strings.Contains(strings.ToLower(ev.Message), "cooling") || strings.Contains(strings.ToLower(ev.Message), "thermal") {
			N_thermal++
		}
	}

	if !hasTubeMAs && len(events) > 0 {
		cumulativeMAs = 7478990.0 // Baseline default count fallback
	}

	// Wear and remaining life
	var L_wear float64
	if activeTube.EolMasMin > 0 {
		L_wear = cumulativeMAs / activeTube.EolMasMin
	}
	thiBase := 1.0 - L_wear
	if thiBase < 0.0 {
		thiBase = 0.0
	} else if thiBase > 1.0 {
		thiBase = 1.0
	}

	// Thermal limits by bearing type
	var thermalEventLimit float64
	if activeTube.Bearing == "liquid" {
		thermalEventLimit = 15.0
	} else {
		thermalEventLimit = 5.0
	}
	L_thermal_alert := N_thermal >= thermalEventLimit
	triggerCritical := (L_wear >= 0.95) || L_thermal_alert

	thermalFactor := 1.0 - (cfg.KThermal * N_thermal / cfg.NMaxThermal)
	if thermalFactor < 0.0 {
		thermalFactor = 0.0
	}

	thi = 100.0 * (thiBase * thermalFactor)
	if triggerCritical {
		thi = 0.0
	}

	// 3. Compute Subsystem Health Indices (SHI) for the 11 subsystems
	subsystems := []string{
		"tube", "hv_generator", "das", "gantry", "collimator",
		"tgp", "obc", "rcib", "table", "cooling", "console",
	}

	shi := make(map[string]float64)
	for _, sub := range subsystems {
		sumDecay := 0.0
		for _, ev := range events {
			evSub := strings.ToLower(ev.Subsystem)
			if evSub == "" {
				evSub = "console"
			}
			if evSub != sub {
				continue
			}

			// Get severity weight
			w := cfg.Weights["info"]
			if w == 0 {
				w = 0.01
			}
			if ev.Severity == "SEVERE_ERROR" || ev.Severity == "CRITICAL" {
				w = cfg.Weights["critical"]
			} else if ev.Severity == "MAJOR_ERROR" {
				w = cfg.Weights["major"]
			} else if ev.Severity == "WARNING" || ev.Severity == "WARN_MINOR" {
				w = cfg.Weights["warning"]
			}

			// Time delta in hours
			deltaT := now.Sub(ev.Timestamp).Hours()
			if ev.Timestamp.IsZero() {
				deltaT = 0
			} else if deltaT < 0 {
				deltaT = 0
			}

			sumDecay += w * math.Exp(-cfg.LambdaDecay*deltaT)
		}

		if sumDecay > 1.0 {
			sumDecay = 1.0
		}
		shi[sub] = 100.0 * (1.0 - sumDecay)
	}

	// 4. Compute Device Health Index (DHI) using configurable alphas
	// DHI = Σ(alpha_s * SHI_s) / Σ(alpha_s)
	sumAlphaSHI := 0.0
	sumAlpha := 0.0
	for _, sub := range subsystems {
		alpha := cfg.Alphas[sub]
		sumAlphaSHI += alpha * shi[sub]
		sumAlpha += alpha
	}

	if sumAlpha > 0 {
		dhi = sumAlphaSHI / sumAlpha
	} else {
		dhi = 100.0
	}

	// 5. Compute Fleet Health Index (FHI)
	// Group events by host to calculate DHI for each device in the fleet
	hostEvents := make(map[string][]models.UnifiedLogEvent)
	for _, ev := range events {
		hostKey := ev.Host
		if hostKey == "" {
			hostKey = "default-host"
		}
		hostEvents[hostKey] = append(hostEvents[hostKey], ev)
	}

	if len(hostEvents) > 1 {
		var sumDHI float64
		for _, hEvents := range hostEvents {
			hShi := make(map[string]float64)
			for _, sub := range subsystems {
				sumDecay := 0.0
				for _, ev := range hEvents {
					evSub := strings.ToLower(ev.Subsystem)
					if evSub == "" {
						evSub = "console"
					}
					if evSub != sub {
						continue
					}
					w := cfg.Weights["info"]
					if w == 0 {
						w = 0.01
					}
					if ev.Severity == "SEVERE_ERROR" || ev.Severity == "CRITICAL" {
						w = cfg.Weights["critical"]
					} else if ev.Severity == "MAJOR_ERROR" {
						w = cfg.Weights["major"]
					} else if ev.Severity == "WARNING" || ev.Severity == "WARN_MINOR" {
						w = cfg.Weights["warning"]
					}
					deltaT := now.Sub(ev.Timestamp).Hours()
					if ev.Timestamp.IsZero() {
						deltaT = 0
					} else if deltaT < 0 {
						deltaT = 0
					}
					sumDecay += w * math.Exp(-cfg.LambdaDecay*deltaT)
				}
				if sumDecay > 1.0 {
					sumDecay = 1.0
				}
				hShi[sub] = 100.0 * (1.0 - sumDecay)
			}

			hSumAlphaSHI := 0.0
			hSumAlpha := 0.0
			for _, sub := range subsystems {
				alpha := cfg.Alphas[sub]
				hSumAlphaSHI += alpha * hShi[sub]
				hSumAlpha += alpha
			}
			hDHI := 100.0
			if hSumAlpha > 0 {
				hDHI = hSumAlphaSHI / hSumAlpha
			}
			sumDHI += hDHI
		}
		fhi = sumDHI / float64(len(hostEvents))
	} else {
		fhi = dhi
	}

	// 6. Return on Investment (ROI) / Ahorro Estimado
	cAvoided := float64(warnCount)*150.0 + float64(critCount)*400.0
	cIntervention := float64(warnCount)*25.0 + float64(critCount)*80.0 + 50.0
	roi = cAvoided - cIntervention
	if roi < 0 {
		roi = 0
	}

	return
}
