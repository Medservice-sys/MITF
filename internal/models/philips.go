package models

// PhilipsEvent represents a single event line from a Philips log
type PhilipsEvent struct {
	Timestamp   string `json:"timestamp"`
	Level       string `json:"level"`
	Module      string `json:"module"`
	Thread      string `json:"thread"`
	FileContext string `json:"file"`
	Code        string `json:"code"`
	Message     string `json:"message"`
	Explanation string `json:"explanation,omitempty"`
	Action      string `json:"action,omitempty"`
	Comments    string `json:"comments,omitempty"`
}

// DiagnosticResult represents the final result sent to the frontend
type DiagnosticResult struct {
	Filename  string         `json:"filename"`
	Summary   string         `json:"summary"`
	Solutions []string       `json:"solutions"`
	Events    []PhilipsEvent `json:"events"`
}
