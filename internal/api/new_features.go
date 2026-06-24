package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"mitf/internal/metrics"
	"mitf/internal/models"

	"golang.org/x/crypto/ssh"
)

// New Feature Data Structs
type TaskRecord struct {
	Action string `json:"action"`
	Result string `json:"result"`
}

type TmfRelatedEntity struct {
	ID           string `json:"id"`
	ReferredType string `json:"@referredType"`
	Role         string `json:"role"`
}

type TmfRelatedParty struct {
	ID   string `json:"id"`
	Role string `json:"role"`
}

type TmfNote struct {
	Text string `json:"text"`
}

type TmfChannel struct {
	Name string `json:"name"`
}

type TicketRecord struct {
	ID                 string             `json:"id"`
	Title              string             `json:"title"`
	Severity           string             `json:"severity"`
	Engineer           string             `json:"engineer"`
	RelatedLogs        string             `json:"relatedLogs"`
	Status             string             `json:"status"` // "open", "closed", "Nuevo", "Reconocido", "Asignado", "En progreso", "En espera", "Resuelto", "Verificado", "Cerrado"
	DateOpened         string             `json:"dateOpened"`
	DateClosed         string             `json:"dateClosed,omitempty"`
	ReviewGeneral      string             `json:"reviewGeneral,omitempty"`
	Diagnosis          string             `json:"diagnosis,omitempty"`
	Tasks              []TaskRecord       `json:"tasks,omitempty"`
	Description        string             `json:"description,omitempty"`
	Priority           string             `json:"priority,omitempty"`
	TicketType         string             `json:"ticketType,omitempty"`
	StatusChangeReason string             `json:"statusChangeReason,omitempty"`
	Channel            *TmfChannel        `json:"channel,omitempty"`
	RelatedEntity      []TmfRelatedEntity `json:"relatedEntity,omitempty"`
	RelatedParty       []TmfRelatedParty  `json:"relatedParty,omitempty"`
	Notes              []TmfNote          `json:"note,omitempty"`
	ResolutionType     string             `json:"resolutionType,omitempty"`
	RemoteEvidence     string             `json:"remoteEvidence,omitempty"`

	// Level 1 Troubleshooting
	L1TroubleshootingDone bool   `json:"l1TroubleshootingDone,omitempty"`
	L1ResolutionAttempt   string `json:"l1ResolutionAttempt,omitempty"`
	L1StandardSuccess     bool   `json:"l1StandardSuccess,omitempty"`
	IsMaskedFailure       bool   `json:"isMaskedFailure,omitempty"`

	// Escalation to L2
	EscalatedToL2   bool   `json:"escalatedToL2,omitempty"`
	L2Engineer      string `json:"l2Engineer,omitempty"`
	L2Diagnosis     string `json:"l2Diagnosis,omitempty"`

	// Parts & Inventory Management
	RequiresParts bool         `json:"requiresParts,omitempty"`
	PartsNeeded   []PartRecord `json:"partsNeeded,omitempty"`

	// Calibration & Quality Validation
	RequiresCalibration bool   `json:"requiresCalibration,omitempty"`
	CalibrationStatus   string `json:"calibrationStatus,omitempty"` // "approved", "failed", "monitoring"
	ClientApproval      string `json:"clientApproval,omitempty"`      // "yes", "no", "monitoring"
	ImageQualityNotes   string `json:"imageQualityNotes,omitempty"`
}

type PartRecord struct {
	PartNumber  string `json:"partNumber"`
	Description string `json:"description"`
	Status      string `json:"status"` // "requested", "in_transit", "received", "installed"
	Eta         string `json:"eta,omitempty"`
}

type KnowledgeBaseEntry struct {
	Code     string `json:"code"`
	Theory   string `json:"theory"`
	Practice string `json:"practice"`
}

type DicomStation struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	AETitle     string `json:"aeTitle"`
	IP          string `json:"ip"`
	Port        int    `json:"port"`
	Status      string `json:"status"`
	Latency     string `json:"latency"`
	LastChecked string `json:"lastChecked"`
}

// Mutexes for safe file access
var (
	maintMu  sync.RWMutex
	kbMu     sync.RWMutex
	stationsMu sync.RWMutex
)

// Memory caches
var (
	ticketRecords []TicketRecord
	knowledgeBase = make(map[string]KnowledgeBaseEntry)
	dicomStations []DicomStation
)

func init() {
	// Seed initial data if files don't exist
	_ = os.MkdirAll("data", 0755)
	initMaintenanceRecords()
	initKnowledgeBase()
	initDicomStations()
}

// ----------------------------------------------------
// 1. Core Data Initializations & Seeding
// ----------------------------------------------------

func initMaintenanceRecords() {
	maintMu.Lock()
	defer maintMu.Unlock()

	file, err := os.ReadFile("data/tickets.json")
	if err == nil {
		_ = json.Unmarshal(file, &ticketRecords)
		return
	}

	// Seed default records
	ticketRecords = []TicketRecord{
		{
			ID:          "TK-402",
			Title:       "Falla de FAN detectada por MITF",
			Severity:    "critical",
			Engineer:    "Juan Pérez",
			RelatedLogs: "MITF-FAN-001",
			Status:      "open",
			DateOpened:  "2026-06-12",
		},
		{
			ID:          "TK-399",
			Title:       "Warning Térmico en Tubo",
			Severity:    "warning",
			Engineer:    "Carlos Mendoza",
			RelatedLogs: "MITF-TEMP-042",
			Status:      "closed",
			DateOpened:  "2026-06-10",
			DateClosed:  "2026-06-11",
			ReviewGeneral: "Revisión visual de sistema de enfriamiento.",
			Diagnosis:   "Radiador parcialmente obstruido por polvo.",
			Tasks: []TaskRecord{
				{Action: "Limpieza de rejillas", Result: "Flujo de aire restablecido"},
				{Action: "Prueba térmica", Result: "Temperaturas en rango nominal (<68C)"},
			},
		},
	}
	saveMaintenanceRecords()
}

func saveMaintenanceRecords() {
	data, _ := json.MarshalIndent(ticketRecords, "", "  ")
	_ = os.WriteFile("data/tickets.json", data, 0644)
}

func initKnowledgeBase() {
	kbMu.Lock()
	defer kbMu.Unlock()

	file, err := os.ReadFile("data/knowledge_base.json")
	if err == nil {
		_ = json.Unmarshal(file, &knowledgeBase)
		return
	}

	// Seed default GE-specific entries
	knowledgeBase = map[string]KnowledgeBaseEntry{
		"MITF.TUBE.TEMP_INDEX": {
			Code:   "MITF.TUBE.TEMP_INDEX",
			Theory: "Advertencia térmica del tubo de rayos X. La temperatura excede el umbral seguro de 68°C. El sistema activa retraso de enfriamiento.",
			Practice: "Falla recurrente por acumulación de polvo en radiador de SRU. Limpiar rejillas de ventilación y comprobar nivel de aceite aislante. Si persiste, verificar bomba de circulación.",
		},
		"MITF.GANTRY.ROTATION_SUCCESS": {
			Code:   "MITF.GANTRY.ROTATION_SUCCESS",
			Theory: "Notificación de rotación exitosa del gantry. Valores nominales de velocidad angular (120 RPM).",
			Practice: "Ninguna acción técnica requerida. Monitorear vibración acústica en caso de reportes de ruido por desgaste de rodamientos.",
		},
		"MITF.COOLING.FLUID_FLOW_ABORT": {
			Code:   "MITF.COOLING.FLUID_FLOW_ABORT",
			Theory: "Aborto de escaneo por flujo de refrigerante insuficiente detectado en sensor de flujo de la unidad de enfriamiento.",
			Practice: "Revisar si hay fugas en mangueras flexibles del gantry. Purgar aire atrapado en circuito de refrigerante y rellenar con mezcla agua/glicol al 50%.",
		},
		"MITF.GANTRY.LOCK_ERROR": {
			Code:   "MITF.GANTRY.LOCK_ERROR",
			Theory: "Fallo en solenoide de traba del rotor de gantry (Rotor lock failed to engage/disengage).",
			Practice: "Desmontar conjunto solenoide, aplicar lubricante seco de teflón. Verificar switch de fin de carrera. Reemplazar bobina de solenoide si la resistencia interna está fuera de rango (nom. 24 Ohms).",
		},
	}
	saveKnowledgeBase()
}

func saveKnowledgeBase() {
	data, _ := json.MarshalIndent(knowledgeBase, "", "  ")
	_ = os.WriteFile("data/knowledge_base.json", data, 0644)
}

func initDicomStations() {
	stationsMu.Lock()
	defer stationsMu.Unlock()

	file, err := os.ReadFile("data/dicom_stations.json")
	if err == nil {
		_ = json.Unmarshal(file, &dicomStations)
		return
	}

	// Seed default stations
	dicomStations = []DicomStation{
		{
			ID:          "station_1",
			Name:        "PACS Central Clínica",
			AETitle:     "PACS_CENTRAL",
			IP:          "192.168.1.100",
			Port:        104,
			Status:      "unknown",
			Latency:     "-",
			LastChecked: "-",
		},
		{
			ID:          "station_2",
			Name:        "Estación de Trabajo 3D",
			AETitle:     "WORKSTATION_3D",
			IP:          "192.168.1.105",
			Port:        11112,
			Status:      "unknown",
			Latency:     "-",
			LastChecked: "-",
		},
		{
			ID:          "station_3",
			Name:        "Impresora DICOM Dryview",
			AETitle:     "DRYVIEW_PRINT",
			IP:          "192.168.1.200",
			Port:        5040,
			Status:      "unknown",
			Latency:     "-",
			LastChecked: "-",
		},
		{
			ID:          "station_4",
			Name:        "Tomógrafo Optima (Local)",
			AETitle:     "GE_CT_CONSOLE",
			IP:          "127.0.0.1",
			Port:        4006,
			Status:      "unknown",
			Latency:     "-",
			LastChecked: "-",
		},
	}
	saveDicomStations()
}

func saveDicomStations() {
	data, _ := json.MarshalIndent(dicomStations, "", "  ")
	_ = os.WriteFile("data/dicom_stations.json", data, 0644)
}

// ----------------------------------------------------
// 2. HTTP Route Handlers
// ----------------------------------------------------

type PredefinedAlarm struct {
	Code            string `json:"code"`
	Label           string `json:"label"`
	DefaultSeverity string `json:"defaultSeverity"`
	Description     string `json:"description"`
	Subsystem       string `json:"subsystem"`
}

var PredefinedAlarms = []PredefinedAlarm{
	{
		Code:            "MITF.TUBE.ARC_DETECTED",
		Label:           "Arco eléctrico interno tubo (JEDI-30)",
		DefaultSeverity: "CRITICAL",
		Description:     "Deterioro de vacío o filamento. Indica aceleración de degradación del cátodo.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.TUBE.ROTATION_ERROR",
		Label:           "Fallo del rotor del ánodo (JEDI-40)",
		DefaultSeverity: "CRITICAL",
		Description:     "Motor de rotación o rotation board del JEDI.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.TUBE.HEATER_ERROR",
		Label:           "Fallo calentador filamento cátodo (JEDI-50)",
		DefaultSeverity: "CRITICAL",
		Description:     "Heater board o PWM drive.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.TUBE.SCAN_BLOCKED",
		Label:           "Bloqueo preventivo del tubo (200110035)",
		DefaultSeverity: "CRITICAL",
		Description:     "Bloqueo por protección de tubo frío. Verificar sensor de temperatura.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.COOLING.FAN_FAULT",
		Label:           "Falla ventilador de enfriamiento (260122004)",
		DefaultSeverity: "CRITICAL",
		Description:     "Fallo ventilador sistema térmico gantry. Fan board (DS1/DS4).",
		Subsystem:       "cooling",
	},
	{
		Code:            "MITF.GANTRY.CONTROL_CRITICAL",
		Label:           "Fallo crítico control gantry (260112009)",
		DefaultSeverity: "CRITICAL",
		Description:     "TGP board o SUPERVISOR FPGA.",
		Subsystem:       "gantry",
	},
	{
		Code:            "MITF.HV_GENERATOR.ORP_CRITICAL",
		Label:           "Error crítico ORP/Jedi (260118155)",
		DefaultSeverity: "CRITICAL",
		Description:     "On-board Rotating Processor — generador JEDI.",
		Subsystem:       "hv_generator",
	},
	{
		Code:            "MITF.CONSOLE.DOSE_DB_ERROR",
		Label:           "Error base de datos de dosis (200180011)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "Error RECURRENTE: archivo Ctdi.cfg no disponible.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.TGP.COMM_LOST",
		Label:           "Pérdida comunicación TGP (244629)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "LSCOM_CTRL module TGP -> ORP.",
		Subsystem:       "tgp",
	},
	{
		Code:            "MITF.CONSOLE.CFG_FILE_MISSING",
		Label:           "Archivo configuración faltante (200002200)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "Error archivo cfg — stat() failed.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.TGP.WATCHDOG_TIMEOUT",
		Label:           "Watchdog Timeout TGP (244642)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "Firmware watchdog timeout. TGP firmware unresponsive.",
		Subsystem:       "tgp",
	},
	{
		Code:            "MITF.CONSOLE.PNP_FAULT",
		Label:           "Fallo Plug and Play (260140030)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "Reset de hardware de escaneo requerido.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.CONSOLE.HARD_RESET",
		Label:           "Hard Reset del sistema (260140018)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "HARD RESET por conexión serial.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.TUBE.IDENTITY_ADVISORY",
		Label:           "Tubo sin Smart ID (244648)",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "Tubo no certificado OEM o reemplazo no reportado.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.TUBE.USAGE_REPORT",
		Label:           "Reporte mAs acumulados (245191)",
		DefaultSeverity: "WARN_MINOR",
		Description:     "Monitorear acumulación vs límite nominal (450,000,000 mAs).",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.GANTRY.USAGE_REPORT",
		Label:           "Reporte revoluciones Gantry (230018036)",
		DefaultSeverity: "WARN_MINOR",
		Description:     "Monitorear desgaste mecánico acumulado.",
		Subsystem:       "gantry",
	},
	{
		Code:            "MITF.TUBE.WARMUP_START",
		Label:           "Inicio Warmup Tubo (230023009)",
		DefaultSeverity: "WARN_MINOR",
		Description:     "Temperatura pre-warmup del tubo. Rango normal: 100-200°C.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.TUBE.WARMUP_COMPLETE",
		Label:           "Warmup Completado (230023010)",
		DefaultSeverity: "WARN_MINOR",
		Description:     "Temperatura post-warmup del tubo. Rango normal: 400-440°C.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.CONSOLE.EXAM_START",
		Label:           "Inicio de Examen (200109109)",
		DefaultSeverity: "INFO",
		Description:     "Informativo — inicio de sesión de escaneo de paciente.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.CONSOLE.EXAM_END",
		Label:           "Fin de Examen (200109110)",
		DefaultSeverity: "INFO",
		Description:     "Informativo — fin de sesión de escaneo de paciente.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.CONSOLE.EXAM_CHECKPOINT",
		Label:           "Punto Control BD Examen (210000454)",
		DefaultSeverity: "INFO",
		Description:     "Confirmación almacenamiento de examen.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.CONSOLE.SYSTEM_BOOT",
		Label:           "Arranque del Sistema (0)",
		DefaultSeverity: "INFO",
		Description:     "Registro de arranque y configuración del sistema.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.CONSOLE.LOG_PRUNED",
		Label:           "Log Purge (4028)",
		DefaultSeverity: "INFO",
		Description:     "Log del sistema GE purgado por espacio.",
		Subsystem:       "console",
	},
	{
		Code:            "MITF.TABLE.UNCOMMANDED_MOTION",
		Label:           "Movimiento no comandado mesa (260134609)",
		DefaultSeverity: "CRITICAL",
		Description:     "Riesgo de colisión o descalibración.",
		Subsystem:       "table",
	},
	{
		Code:            "MITF.TUBE.FILAMENT_HEAT",
		Label:           "Calentamiento de filamento",
		DefaultSeverity: "INFO",
		Description:     "Monitoreo de corriente de filamento.",
		Subsystem:       "tube",
	},
	{
		Code:            "MITF.DAS.ACQUISITION",
		Label:           "Adquisición de vistas de detector",
		DefaultSeverity: "INFO",
		Description:     "Adquisición de datos en proceso.",
		Subsystem:       "das",
	},
	{
		Code:            "MITF.COOLING.TEMPERATURE_INDEX",
		Label:           "Índice de temperatura de refrigeración",
		DefaultSeverity: "WARN_MINOR",
		Description:     "Monitoreo térmico del circuito de enfriamiento.",
		Subsystem:       "cooling",
	},
	{
		Code:            "MITF.OBC.RECON_EVENT",
		Label:           "Evento de Reconstrucción (RECON)",
		DefaultSeverity: "INFO",
		Description:     "Actividad normal de reconstrucción de imágenes.",
		Subsystem:       "obc",
	},
	{
		Code:            "MITF.OBC.SCRATCHPAD_ERROR",
		Label:           "Error en scratchpad de reconstrucción",
		DefaultSeverity: "MAJOR_ERROR",
		Description:     "Falla de lectura/escritura de config scratchpad.",
		Subsystem:       "obc",
	},
	{
		Code:            "MITF.CONSOLE.SYSSTATE",
		Label:           "Cambio de estado del sistema",
		DefaultSeverity: "INFO",
		Description:     "Registro de inicio/fin de operación.",
		Subsystem:       "console",
	},
}

type AlarmInfo struct {
	Code            string `json:"code"`
	Label           string `json:"label"`
	DefaultSeverity string `json:"defaultSeverity"`
	CurrentSeverity string `json:"currentSeverity"`
	Description     string `json:"description"`
	Subsystem       string `json:"subsystem"`
	Status          string `json:"status"` // "CONFIRMED" or "PENDING"
	IsNew           bool   `json:"isNew"`
}

type ClassificationsResponse struct {
	Overrides map[string]string `json:"overrides"`
	Alarms    []AlarmInfo       `json:"alarms"`
}

var CustomCatalog []PredefinedAlarm
var CustomCatalogMu sync.RWMutex
var catalogOnce sync.Once

func loadCustomCatalog() {
	file, err := os.ReadFile("data/custom_catalog.json")
	if err != nil {
		CustomCatalog = []PredefinedAlarm{}
		saveCustomCatalogLocked()
		return
	}
	_ = json.Unmarshal(file, &CustomCatalog)
}

func saveCustomCatalogLocked() {
	data, _ := json.MarshalIndent(CustomCatalog, "", "  ")
	_ = os.WriteFile("data/custom_catalog.json", data, 0644)
}

func GetMergedAlarms() []AlarmInfo {
	catalogOnce.Do(loadCustomCatalog)

	CustomClassificationsMu.RLock()
	defer CustomClassificationsMu.RUnlock()

	// Track seen codes
	seen := make(map[string]bool)
	var list []AlarmInfo

	// Add predefined alarms
	for _, alarm := range PredefinedAlarms {
		code := alarm.Code
		seen[code] = true

		current := alarm.DefaultSeverity
		status := "PENDING"
		if val, ok := CustomClassifications[code]; ok {
			current = val
			status = "CONFIRMED"
		}

		list = append(list, AlarmInfo{
			Code:            code,
			Label:           alarm.Label,
			DefaultSeverity: alarm.DefaultSeverity,
			CurrentSeverity: current,
			Description:     alarm.Description,
			Subsystem:       alarm.Subsystem,
			Status:          status,
			IsNew:           false,
		})
	}

	// Add custom catalog extensions
	CustomCatalogMu.RLock()
	for _, alarm := range CustomCatalog {
		code := alarm.Code
		seen[code] = true

		current := alarm.DefaultSeverity
		status := "PENDING"
		if val, ok := CustomClassifications[code]; ok {
			current = val
			status = "CONFIRMED"
		}

		list = append(list, AlarmInfo{
			Code:            code,
			Label:           alarm.Label,
			DefaultSeverity: alarm.DefaultSeverity,
			CurrentSeverity: current,
			Description:     alarm.Description,
			Subsystem:       alarm.Subsystem,
			Status:          status,
			IsNew:           false,
		})
	}
	CustomCatalogMu.RUnlock()

	// Scan Store.Events for dynamic alarms
	Store.mu.RLock()
	defer Store.mu.RUnlock()

	for _, ev := range Store.Events {
		code := ev.TCECode
		if code == "" {
			code = ev.Process
		}
		if code == "" || strings.Contains(code, "GENERIC") {
			continue
		}

		if !seen[code] {
			seen[code] = true

			// Map raw severity to standard
			defSev := "WARN_MINOR"
			if ev.Severity == "SEVERE_ERROR" || ev.Severity == "CRITICAL" {
				defSev = "CRITICAL"
			} else if ev.Severity == "WARNING" {
				defSev = "WARN_MINOR"
			} else if ev.Severity == "INFORMATIONAL" || ev.Severity == "INFO" {
				defSev = "INFO"
			}

			current := defSev
			status := "PENDING"
			if val, ok := CustomClassifications[code]; ok {
				current = val
				status = "CONFIRMED"
			}

			label := "Alarma Dinámica: " + code
			if ev.Process != "" {
				label = fmt.Sprintf("Evento de Proceso %s (%s)", ev.Process, code)
			}

			list = append(list, AlarmInfo{
				Code:            code,
				Label:           label,
				DefaultSeverity: defSev,
				CurrentSeverity: current,
				Description:     "Alarma detectada dinámicamente en los logs del tomógrafo.",
				Subsystem:       ev.Subsystem,
				Status:          status,
				IsNew:           true,
			})
		}
	}

	return list
}

// HandleAdminClassifications reads and updates custom alarm severity levels
func HandleAdminClassifications(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		CustomClassificationsMu.RLock()
		overrides := make(map[string]string)
		for k, v := range CustomClassifications {
			overrides[k] = v
		}
		CustomClassificationsMu.RUnlock()

		alarms := GetMergedAlarms()

		resp := ClassificationsResponse{
			Overrides: overrides,
			Alarms:    alarms,
		}

		json.NewEncoder(w).Encode(resp)
		return
	}

	if r.Method == http.MethodPost {
		var newRules map[string]string
		if err := json.NewDecoder(r.Body).Decode(&newRules); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}

		CustomClassificationsMu.Lock()
		CustomClassifications = newRules
		saveClassifications()
		CustomClassificationsMu.Unlock()

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleAdminCatalog handles creation of custom alarm types/categories
func HandleAdminCatalog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodPost {
		var newAlarm PredefinedAlarm
		if err := json.NewDecoder(r.Body).Decode(&newAlarm); err != nil {
			http.Error(w, "Invalid request payload", http.StatusBadRequest)
			return
		}

		if newAlarm.Code == "" || newAlarm.Label == "" || newAlarm.Subsystem == "" || newAlarm.DefaultSeverity == "" {
			http.Error(w, "Todos los campos (código, etiqueta, subsistema, severidad por defecto) son requeridos", http.StatusBadRequest)
			return
		}

		catalogOnce.Do(loadCustomCatalog)

		CustomCatalogMu.Lock()
		defer CustomCatalogMu.Unlock()

		// Verify uniqueness
		exists := false
		for _, a := range PredefinedAlarms {
			if strings.EqualFold(a.Code, newAlarm.Code) {
				exists = true
				break
			}
		}
		if !exists {
			for _, a := range CustomCatalog {
				if strings.EqualFold(a.Code, newAlarm.Code) {
					exists = true
					break
				}
			}
		}

		if exists {
			http.Error(w, "El código de evento/alarma ya existe en el catálogo", http.StatusConflict)
			return
		}

		CustomCatalog = append(CustomCatalog, newAlarm)
		saveCustomCatalogLocked()

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Nuevo tipo de evento agregado exitosamente al catálogo"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleAdminHealthConfig manages reading and writing the Health Modeling Framework parameters
func HandleAdminHealthConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		json.NewEncoder(w).Encode(metrics.GetConfig())
		return
	}

	if r.Method == http.MethodPost {
		var cfg metrics.HealthModelConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			http.Error(w, "JSON de parámetros inválido", http.StatusBadRequest)
			return
		}

		metrics.SaveConfig(cfg)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "saved", "message": "Parámetros de modelado de salud actualizados correctamente"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleAdminTubeModels returns the tube taxonomy from data/tube_models.json
func HandleAdminTubeModels(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		data, err := os.ReadFile("data/tube_models.json")
		if err != nil {
			http.Error(w, "Error al leer taxonomía de tubos: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Write(data)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleConfig manages current operation mode (Modo Online vs Modo Servicio), refresh interval, and monitored devices
func HandleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		OperationModeMu.RLock()
		mode := OperationMode
		OperationModeMu.RUnlock()

		DeviceProfilesMu.RLock()
		refresh := GlobalRefreshSec
		devices := make([]models.DeviceProfile, len(DeviceProfiles))
		copy(devices, DeviceProfiles)
		DeviceProfilesMu.RUnlock()

		json.NewEncoder(w).Encode(map[string]interface{}{
			"operationMode":   mode,
			"refreshInterval": refresh,
			"devices":         devices,
		})
		return
	}

	if r.Method == http.MethodPost {
		var req struct {
			OperationMode   string                 `json:"operationMode"`
			RefreshInterval int                    `json:"refreshInterval"`
			Devices         []models.DeviceProfile `json:"devices"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid body: "+err.Error(), http.StatusBadRequest)
			return
		}

		if req.OperationMode != "online" && req.OperationMode != "service" {
			http.Error(w, "Invalid mode (must be 'online' or 'service')", http.StatusBadRequest)
			return
		}

		if req.RefreshInterval < 5 {
			req.RefreshInterval = 15
		}

		OperationModeMu.Lock()
		OperationMode = req.OperationMode
		OperationModeMu.Unlock()

		DeviceProfilesMu.Lock()
		GlobalRefreshSec = req.RefreshInterval
		if req.Devices != nil {
			DeviceProfiles = req.Devices
		}
		DeviceProfilesMu.Unlock()

		// Save general config
		cfgData, _ := json.MarshalIndent(map[string]interface{}{
			"operationMode":   req.OperationMode,
			"refreshInterval": req.RefreshInterval,
		}, "", "  ")
		_ = os.WriteFile("data/config.json", cfgData, 0644)

		// Save devices
		DeviceProfilesMu.RLock()
		devData, _ := json.MarshalIndent(DeviceProfiles, "", "  ")
		_ = os.WriteFile("data/devices.json", devData, 0644)
		DeviceProfilesMu.RUnlock()

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":          "saved",
			"operationMode":   req.OperationMode,
			"refreshInterval": req.RefreshInterval,
			"devices":         req.Devices,
		})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleMaintenanceRecords gets or appends ticket actions
func HandleMaintenanceRecords(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		maintMu.RLock()
		defer maintMu.RUnlock()
		json.NewEncoder(w).Encode(ticketRecords)
		return
	}

	if r.Method == http.MethodPost {
		var rec TicketRecord
		if err := json.NewDecoder(r.Body).Decode(&rec); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		maintMu.Lock()
		
		// If ID is provided and exists, update it. Otherwise create new.
		found := false
		for i, t := range ticketRecords {
			if t.ID == rec.ID && rec.ID != "" {
				ticketRecords[i] = rec
				found = true
				break
			}
		}

		if !found {
			if rec.ID == "" {
				rec.ID = fmt.Sprintf("TK-%d", time.Now().Unix()%10000)
			}
			if rec.DateOpened == "" {
				rec.DateOpened = time.Now().Format("2006-01-02 15:04:05")
			}
			if rec.Status == "" {
				rec.Status = "open"
			}
			ticketRecords = append([]TicketRecord{rec}, ticketRecords...) // prepend latest
		}

		saveMaintenanceRecords()
		maintMu.Unlock()

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(rec)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

type TmfTroubleTicket struct {
	ID                 string             `json:"id,omitempty"`
	Href               string             `json:"href,omitempty"`
	Name               string             `json:"name"`
	Description        string             `json:"description,omitempty"`
	Severity           string             `json:"severity"`
	Priority           string             `json:"priority,omitempty"`
	TicketType         string             `json:"ticketType,omitempty"`
	Status             string             `json:"status"`
	StatusChangeReason string             `json:"statusChangeReason,omitempty"`
	Channel            *TmfChannel        `json:"channel,omitempty"`
	RelatedEntity      []TmfRelatedEntity `json:"relatedEntity,omitempty"`
	RelatedParty       []TmfRelatedParty  `json:"relatedParty,omitempty"`
	Note               []TmfNote          `json:"note,omitempty"`
}

func mapTicketToTmf(tk TicketRecord) TmfTroubleTicket {
	tmfStatus := "acknowledged"
	switch tk.Status {
	case "Nuevo", "Reconocido":
		tmfStatus = "acknowledged"
	case "Asignado", "En progreso":
		tmfStatus = "inProgress"
	case "En espera":
		tmfStatus = "pending"
	case "Resuelto", "Verificado":
		tmfStatus = "resolved"
	case "Cerrado":
		tmfStatus = "closed"
	case "Cancelado", "Rechazado":
		tmfStatus = "cancelled"
	}

	tmf := TmfTroubleTicket{
		ID:                 tk.ID,
		Href:               "/troubleTicketManagement/v4/troubleTicket/" + tk.ID,
		Name:               tk.Title,
		Description:        tk.Description,
		Severity:           tk.Severity,
		Priority:           tk.Priority,
		TicketType:         tk.TicketType,
		Status:             tmfStatus,
		StatusChangeReason: tk.StatusChangeReason,
		Channel:            tk.Channel,
		RelatedEntity:      tk.RelatedEntity,
		RelatedParty:       tk.RelatedParty,
		Note:               tk.Notes,
	}

	if tmf.Description == "" {
		tmf.Description = "Creado desde la consola MITF."
	}
	if tmf.Priority == "" {
		if tk.Severity == "critical" {
			tmf.Priority = "1"
		} else if tk.Severity == "major" {
			tmf.Priority = "2"
		} else {
			tmf.Priority = "3"
		}
	}
	if tmf.TicketType == "" {
		tmf.TicketType = "network-fault"
	}
	if len(tmf.RelatedEntity) == 0 && tk.RelatedLogs != "" {
		logs := strings.Split(tk.RelatedLogs, ",")
		for _, logId := range logs {
			logId = strings.TrimSpace(logId)
			if logId != "" {
				tmf.RelatedEntity = append(tmf.RelatedEntity, TmfRelatedEntity{
					ID:           logId,
					ReferredType: "Alarm",
					Role:         "root-cause",
				})
			}
		}
	}
	if len(tmf.RelatedParty) == 0 {
		tmf.RelatedParty = []TmfRelatedParty{
			{ID: tk.Engineer, Role: "creator"},
		}
	}

	return tmf
}

func HandleTroubleTicket(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == http.MethodGet {
		maintMu.RLock()
		defer maintMu.RUnlock()

		idQuery := r.URL.Query().Get("id")
		if idQuery != "" {
			for _, tk := range ticketRecords {
				if tk.ID == idQuery {
					tmf := mapTicketToTmf(tk)
					json.NewEncoder(w).Encode(tmf)
					return
				}
			}
			http.Error(w, "Ticket not found", http.StatusNotFound)
			return
		}

		var list []TmfTroubleTicket
		for _, tk := range ticketRecords {
			list = append(list, mapTicketToTmf(tk))
		}
		json.NewEncoder(w).Encode(list)
		return
	}

	if r.Method == http.MethodPost {
		var tmf TmfTroubleTicket
		if err := json.NewDecoder(r.Body).Decode(&tmf); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		maintMu.Lock()
		
		var rec TicketRecord
		rec.ID = tmf.ID
		if rec.ID == "" {
			rec.ID = fmt.Sprintf("TK-%d", time.Now().Unix()%10000)
		}
		rec.Title = tmf.Name
		rec.Severity = tmf.Severity
		
		// Map TMF621 status to ATREC status
		rec.Status = "Nuevo"
		switch tmf.Status {
		case "acknowledged":
			rec.Status = "Nuevo"
		case "inProgress":
			rec.Status = "Asignado"
		case "held", "pending":
			rec.Status = "En espera"
		case "resolved":
			rec.Status = "Resuelto"
		case "closed":
			rec.Status = "Cerrado"
		case "cancelled", "rejected":
			rec.Status = "Cancelado"
		default:
			if tmf.Status != "" {
				rec.Status = tmf.Status
			}
		}

		rec.DateOpened = time.Now().Format("2006-01-02 15:04:05")
		
		var logIDs []string
		for _, entity := range tmf.RelatedEntity {
			logIDs = append(logIDs, entity.ID)
		}
		rec.RelatedLogs = strings.Join(logIDs, ", ")
		
		rec.Description = tmf.Description
		rec.Priority = tmf.Priority
		rec.TicketType = tmf.TicketType
		rec.StatusChangeReason = tmf.StatusChangeReason
		rec.Channel = tmf.Channel
		rec.RelatedEntity = tmf.RelatedEntity
		rec.RelatedParty = tmf.RelatedParty
		rec.Notes = tmf.Note

		rec.Engineer = "NOC Operator"
		for _, party := range tmf.RelatedParty {
			if party.Role == "creator" {
				rec.Engineer = party.ID
			}
		}
		for _, party := range tmf.RelatedParty {
			if party.Role == "assignedGroup" {
				rec.Engineer = party.ID
			}
		}

		ticketRecords = append([]TicketRecord{rec}, ticketRecords...)
		saveMaintenanceRecords()
		maintMu.Unlock()

		tmf.ID = rec.ID
		tmf.Href = "/troubleTicketManagement/v4/troubleTicket/" + rec.ID
		
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(tmf)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleKnowledge manages manual error fixes and theoretical definitions
func HandleKnowledge(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		kbMu.RLock()
		defer kbMu.RUnlock()
		json.NewEncoder(w).Encode(knowledgeBase)
		return
	}

	if r.Method == http.MethodPost {
		var entry KnowledgeBaseEntry
		if err := json.NewDecoder(r.Body).Decode(&entry); err != nil || entry.Code == "" {
			http.Error(w, "Invalid entry data", http.StatusBadRequest)
			return
		}

		kbMu.Lock()
		// Merge or set values
		existing, ok := knowledgeBase[entry.Code]
		if ok {
			if entry.Theory != "" {
				existing.Theory = entry.Theory
			}
			existing.Practice = entry.Practice
			knowledgeBase[entry.Code] = existing
		} else {
			knowledgeBase[entry.Code] = entry
		}
		saveKnowledgeBase()
		kbMu.Unlock()

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(knowledgeBase[entry.Code])
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleDicomStations lists, adds or updates DICOM endpoints
func HandleDicomStations(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == http.MethodGet {
		stationsMu.RLock()
		defer stationsMu.RUnlock()
		json.NewEncoder(w).Encode(dicomStations)
		return
	}

	if r.Method == http.MethodPost {
		var newStations []DicomStation
		if err := json.NewDecoder(r.Body).Decode(&newStations); err != nil {
			http.Error(w, "Invalid body", http.StatusBadRequest)
			return
		}

		stationsMu.Lock()
		dicomStations = newStations
		saveDicomStations()
		stationsMu.Unlock()

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(dicomStations)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// HandleDicomPing executes a TCP Dial + A-ASSOCIATE-RQ C-ECHO DICOM Ping simulation
func HandleDicomPing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	stationsMu.Lock()
	var targetStation *DicomStation
	targetIdx := -1
	for idx, s := range dicomStations {
		if s.ID == req.ID {
			targetStation = &dicomStations[idx]
			targetIdx = idx
			break
		}
	}
	stationsMu.Unlock()

	if targetStation == nil {
		http.Error(w, "Station not found", http.StatusNotFound)
		return
	}

	// Trigger Dicom ping
	online, latency, err := performDicomPing(targetStation.IP, targetStation.Port, targetStation.AETitle, "MITF_MONITOR")

	stationsMu.Lock()
	if err != nil {
		dicomStations[targetIdx].Status = "offline"
		dicomStations[targetIdx].Latency = "-"
		dicomStations[targetIdx].LastChecked = time.Now().Format("2006-01-02 15:04:05")
	} else {
		dicomStations[targetIdx].Status = "online"
		if online {
			dicomStations[targetIdx].Status = "online" // DICOM Active
		} else {
			dicomStations[targetIdx].Status = "degraded" // TCP Active, but DICOM handshake failed/rejected
		}
		dicomStations[targetIdx].Latency = fmt.Sprintf("%d ms", latency.Milliseconds())
		dicomStations[targetIdx].LastChecked = time.Now().Format("2006-01-02 15:04:05")
	}
	saveDicomStations()
	updatedStation := dicomStations[targetIdx]
	stationsMu.Unlock()

	resp := map[string]interface{}{
		"id":          updatedStation.ID,
		"status":      updatedStation.Status,
		"latency":     updatedStation.Latency,
		"lastChecked": updatedStation.LastChecked,
		"error":       "",
	}
	if err != nil {
		resp["error"] = err.Error()
	}

	json.NewEncoder(w).Encode(resp)
}

// performDicomPing builds a standard A-ASSOCIATE-RQ packet and sends it via TCP
func performDicomPing(ip string, port int, calledAET, callingAET string) (bool, time.Duration, error) {
	start := time.Now()
	
	// Establish TCP Connection
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", ip, port), 2*time.Second)
	if err != nil {
		return false, 0, err
	}
	defer conn.Close()

	// Build a standard minimal A-ASSOCIATE-RQ PDU for DICOM handshake
	called := fmt.Sprintf("%-16s", calledAET)[:16]
	calling := fmt.Sprintf("%-16s", callingAET)[:16]

	pdu := make([]byte, 0, 100)
	pdu = append(pdu, 0x01, 0x00) // Type: Associate Request, Reserved

	// Application Context Item
	appCtx := []byte{0x10, 0x00, 0x00, 0x15}
	appCtx = append(appCtx, []byte("1.2.840.10008.3.1.1.1")...)

	// Presentation Context Item for C-ECHO Verification SOP Class (1.2.840.10008.1.1)
	absSyntax := []byte{0x30, 0x00, 0x00, 0x11}
	absSyntax = append(absSyntax, []byte("1.2.840.10008.1.1")...)
	
	// Transfer Syntax Sub-item: Implicit VR Little Endian (1.2.840.10008.1.2)
	xferSyntax := []byte{0x40, 0x00, 0x00, 0x11}
	xferSyntax = append(xferSyntax, []byte("1.2.840.10008.1.2")...)
	
	presCtxLen := uint16(1 + 3 + len(absSyntax) + len(xferSyntax))
	presCtx := []byte{0x20, 0x00, byte(presCtxLen >> 8), byte(presCtxLen & 0xFF), 0x01, 0x00, 0x00, 0x00}
	presCtx = append(presCtx, absSyntax...)
	presCtx = append(presCtx, xferSyntax...)

	// User Information Item
	user := []byte{0x50, 0x00, 0x00, 0x08, 0x51, 0x00, 0x00, 0x04, 0x00, 0x00, 0x40, 0x00}

	variableItems := make([]byte, 0, len(appCtx)+len(presCtx)+len(user))
	variableItems = append(variableItems, appCtx...)
	variableItems = append(variableItems, presCtx...)
	variableItems = append(variableItems, user...)

	pduLength := uint32(2 + 2 + 16 + 16 + 32 + len(variableItems))
	
	header := []byte{
		byte(pduLength >> 24), byte(pduLength >> 16), byte(pduLength >> 8), byte(pduLength & 0xFF),
		0x00, 0x01, // Protocol Version
		0x00, 0x00, // Reserved
	}
	
	pdu = append(pdu, header...)
	pdu = append(pdu, []byte(called)...)
	pdu = append(pdu, []byte(calling)...)
	pdu = append(pdu, make([]byte, 32)...) // 32 Reserved bytes
	pdu = append(pdu, variableItems...)

	_ = conn.SetDeadline(time.Now().Add(2 * time.Second))
	_, err = conn.Write(pdu)
	if err != nil {
		return false, 0, err
	}

	respHeader := make([]byte, 6)
	_, err = io.ReadFull(conn, respHeader)
	if err != nil {
		// TCP is online, but target closed connection on packet or timed out (it might not speak DICOM)
		return false, time.Since(start), nil
	}

	pduType := respHeader[0]
	if pduType == 0x02 { // A-ASSOCIATE-AC (Association Accept)
		return true, time.Since(start), nil
	}

	// Association Rejected or Aborted
	return false, time.Since(start), nil
}

// HandleDevicePing attempts to TCP dial and optionally SSH handshake a Monitored Device
func HandleDevicePing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	DeviceProfilesMu.RLock()
	var targetDev *models.DeviceProfile
	for idx, dev := range DeviceProfiles {
		if dev.ID == req.ID {
			targetDev = &DeviceProfiles[idx]
			break
		}
	}
	DeviceProfilesMu.RUnlock()

	if targetDev == nil {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}

	// Ping logic
	start := time.Now()
	host := targetDev.Host
	if !strings.Contains(host, ":") {
		host = host + ":22"
	}

	// 1. TCP dial
	conn, err := net.DialTimeout("tcp", host, 2*time.Second)
	if err != nil {
		resp := map[string]interface{}{
			"id":      targetDev.ID,
			"status":  "offline",
			"latency": "-",
			"error":   fmt.Sprintf("TCP dial failed: %v", err),
		}
		json.NewEncoder(w).Encode(resp)
		return
	}
	defer conn.Close()

	latency := time.Since(start)

	// 2. SSH handshake
	sshConfig := &ssh.ClientConfig{
		User: targetDev.User,
		Auth: []ssh.AuthMethod{
			ssh.Password(targetDev.Password),
			ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) (answers []string, err error) {
				answers = make([]string, len(questions))
				for i := range answers {
					answers[i] = targetDev.Password
				}
				return answers, nil
			}),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         2 * time.Second,
	}

	if targetDev.SSHMode == "legacy" {
		sshConfig.HostKeyAlgorithms = []string{
			ssh.KeyAlgoRSA,
		}
		sshConfig.Config = ssh.Config{
			KeyExchanges: []string{
				"diffie-hellman-group-exchange-sha256",
				"diffie-hellman-group-exchange-sha1",
				"diffie-hellman-group14-sha1",
				"diffie-hellman-group1-sha1",
			},
			Ciphers: []string{
				"aes128-cbc",
				"3des-cbc",
				"blowfish-cbc",
				"aes128-ctr",
				"aes192-ctr",
				"aes256-ctr",
			},
			MACs: []string{
				"hmac-sha1",
				"hmac-md5",
				"hmac-ripemd160",
			},
		}
	}

	// Set deadline for TCP socket connection during handshake
	_ = conn.SetDeadline(time.Now().Add(3 * time.Second))
	sshConn, _, _, err := ssh.NewClientConn(conn, host, sshConfig)
	if err != nil {
		// TCP is online, but SSH failed
		resp := map[string]interface{}{
			"id":      targetDev.ID,
			"status":  "degraded", // TCP active, SSH credentials/handshake failed
			"latency": fmt.Sprintf("%d ms", latency.Milliseconds()),
			"error":   fmt.Sprintf("SSH handshake failed: %v", err),
		}
		json.NewEncoder(w).Encode(resp)
		return
	}
	sshConn.Close()

	resp := map[string]interface{}{
		"id":      targetDev.ID,
		"status":  "online",
		"latency": fmt.Sprintf("%d ms", latency.Milliseconds()),
		"error":   "",
	}
	json.NewEncoder(w).Encode(resp)
}
