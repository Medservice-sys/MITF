package api

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"mitf/internal/parser"
)

// HandlePhilipsUpload receives the .tar or .tar.gz file from the frontend
// and processes it with the Philips log parser.
func HandlePhilipsUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse our multipart form, 50 << 20 specifies a maximum upload of 50 MB files.
	if err := r.ParseMultipartForm(50 << 20); err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		http.Error(w, "Error parsing form", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		log.Printf("Error retrieving the file: %v", err)
		http.Error(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	log.Printf("Uploaded File: %+v\n", handler.Filename)
	log.Printf("File Size: %+v\n", handler.Size)
	log.Printf("MIME Header: %+v\n", handler.Header)

	// Create scratch directory if it doesn't exist
	scratchDir := "./scratch"
	if err := os.MkdirAll(scratchDir, os.ModePerm); err != nil {
		log.Printf("Error creating scratch dir: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Create a temporary file within our scratch directory
	tempFile, err := os.Create(filepath.Join(scratchDir, handler.Filename))
	if err != nil {
		log.Printf("Error creating temp file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer tempFile.Close()

	// Read all of the contents of our uploaded file into a byte array
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Error reading file: %v", err)
		http.Error(w, "Error reading file", http.StatusInternalServerError)
		return
	}
	// Write this byte array to our temporary file
	tempFile.Write(fileBytes)
	fullPath := tempFile.Name()

	// Call the parser to analyze the file
	diagnosticResult, err := parser.ParsePhilipsBugReport(fullPath, handler.Filename)
	if err != nil {
		log.Printf("Error parsing bug report: %v", err)
		http.Error(w, "Error parsing file", http.StatusInternalServerError)
		return
	}

	// Return the result as JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(diagnosticResult); err != nil {
		log.Printf("Error encoding response: %v", err)
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
		return
	}
}
