package analyzer

// SolutionGuide represents the structured advice for a specific error code
type SolutionGuide struct {
	Summary     string
	Explanation string
	Action      string
	Comments    string
	Solutions   []string
}

// KnowledgeBase is our mock DB mapping ErrNum to a SolutionGuide
var KnowledgeBase = map[string]SolutionGuide{
	"S_LIFESYNCMGRTASK_LIFESYNC_FAIL": {
		Summary:     "Falla detectada en la comunicación con el subsistema MESA (MESAFAILURE). Pérdida de sincronización de rotación.",
		Explanation: "Ghost error when one of the controllers STOPs responding to Life Sync Request. Param1->bitPattern: GHOST=1, RHOST= 2, DMC=4, COUCH=8, or combination (ex.: Param1=6 -> RHOST & DMC did not respond). Gantry recovers when all configured boards are on-line.",
		Action:      "1) Check controller identified by Param1. Often occurs with fatal on this controller. 2) If life sync requests appear in CANTracer, answers from controller are not, check CAN communications -> CAN cables and terminations",
		Comments:    "A controller is LOST",
		Solutions: []string{
			"Revisar conexiones físicas del cableado MESA (J1, J2) hacia la placa principal.",
			"Comprobar el anillo colector (Slip Ring) por desgaste en las escobillas de comunicación.",
			"Realizar prueba de diagnóstico MESA desde la consola de servicio nivel 2.",
		},
	},
	"S_MES_SYNC_DELAY": {
		Summary:     "Advertencia de latencia en la sincronización MESA.",
		Explanation: "MESA rotation synchronization is experiencing high latency (>5ms).",
		Action:      "Check network load on CAN bus. Verify slip ring contacts.",
		Comments:    "Initial warning before failure.",
		Solutions: []string{
			"Limpiar el anillo colector preventivamente.",
		},
	},
}

// GetSolutionGuide returns a guide for a given error code, or nil if not found
func GetSolutionGuide(errCode string) *SolutionGuide {
	if guide, exists := KnowledgeBase[errCode]; exists {
		return &guide
	}
	return nil
}
