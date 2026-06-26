package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"mitf/internal/db"
	"mitf/internal/models"
)

// LoadUsersOnStartup initializes users database table in PostgreSQL
func LoadUsersOnStartup() {
	if db.GetDB() == nil {
		log.Println("[USERS] WARNING: Database connection is nil, users table cannot be initialized.")
		return
	}

	createTableQuery := `
	CREATE TABLE IF NOT EXISTS users (
		username VARCHAR(255) PRIMARY KEY,
		password VARCHAR(255) NOT NULL,
		role VARCHAR(50) NOT NULL,
		full_name VARCHAR(255) NOT NULL,
		device_id VARCHAR(255) NULL
	);`

	_, err := db.GetDB().Exec(createTableQuery)
	if err != nil {
		log.Fatalf("[USERS] Error creating users table: %v", err)
	}

	// Upgrade schema if running on existing database
	_, _ = db.GetDB().Exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);")

	// Insert default users if table is empty
	var count int
	err = db.GetDB().QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		log.Fatalf("[USERS] Error checking users count: %v", err)
	}

	if count == 0 {
		var defaultUsers []models.User

		// Try to read existing users from users.json to migrate them
		file, err := os.ReadFile("data/users.json")
		if err == nil {
			log.Println("[USERS] Users table is empty. Migrating existing users from data/users.json...")
			if unmarshalErr := json.Unmarshal(file, &defaultUsers); unmarshalErr != nil {
				log.Printf("[USERS] Error parsing users.json: %v. Will fallback to default hardcoded users.", unmarshalErr)
			}
		}

		if len(defaultUsers) == 0 {
			log.Println("[USERS] Users table is empty and no valid json found, initializing with default credentials...")
			defaultUsers = []models.User{
				{Username: "admin", Password: "admin", Role: "admin", FullName: "Administrador NOC"},
				{Username: "operator", Password: "operator", Role: "operator", FullName: "Operador de Turno NOC"},
				{Username: "mquino", Password: "mquino", Role: "engineer", FullName: "Ing. M. Quino (IC 1)"},
				{Username: "jquispe", Password: "jquispe", Role: "engineer", FullName: "Ing. J. Quispe (IC 2)"},
				{Username: "jcontreras", Password: "jcontreras", Role: "engineer", FullName: "Ing. J. Contreras (IC 3)"},
			}
		}

		for _, u := range defaultUsers {
			_, err := db.GetDB().Exec("INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)",
				u.Username, u.Password, u.Role, u.FullName)
			if err != nil {
				log.Printf("[USERS] Error inserting user %s: %v", u.Username, err)
			}
		}
		log.Printf("[USERS] Inserted %d users into the database.", len(defaultUsers))
	} else {
		log.Printf("[USERS] Users database ready, found %d users.", count)
	}
}

// HandleUsers handles user listing, creation, modification, and deletion (CRUD)
func HandleUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if db.GetDB() == nil {
		http.Error(w, `{"error": "Database not initialized"}`, http.StatusInternalServerError)
		return
	}

	switch r.Method {
	case "GET":
		rows, err := db.GetDB().Query("SELECT username, password, role, full_name, device_id FROM users")
		if err != nil {
			http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		var list []models.User
		for rows.Next() {
			var u models.User
			var deviceID sql.NullString
			if err := rows.Scan(&u.Username, &u.Password, &u.Role, &u.FullName, &deviceID); err != nil {
				continue
			}
			if deviceID.Valid {
				u.DeviceID = deviceID.String
			}
			list = append(list, u)
		}
		json.NewEncoder(w).Encode(list)

	case "POST":
		var u models.User
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
			return
		}

		u.Username = strings.TrimSpace(strings.ToLower(u.Username))
		if u.Username == "" || u.Password == "" || u.Role == "" || u.FullName == "" {
			http.Error(w, `{"error": "All fields are required (username, password, role, fullName)"}`, http.StatusBadRequest)
			return
		}

		_, err := db.GetDB().Exec("INSERT INTO users (username, password, role, full_name, device_id) VALUES ($1, $2, $3, $4, $5)",
			u.Username, u.Password, u.Role, u.FullName, sql.NullString{String: u.DeviceID, Valid: u.DeviceID != ""})
		if err != nil {
			http.Error(w, `{"error": "El nombre de usuario ya existe o error en base de datos"}`, http.StatusConflict)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Usuario creado exitosamente"})

	case "PUT":
		var u models.User
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
			return
		}

		u.Username = strings.TrimSpace(strings.ToLower(u.Username))
		if u.Username == "" || u.Password == "" || u.Role == "" || u.FullName == "" {
			http.Error(w, `{"error": "All fields are required"}`, http.StatusBadRequest)
			return
		}

		res, err := db.GetDB().Exec("UPDATE users SET password = $1, role = $2, full_name = $3, device_id = $4 WHERE username = $5",
			u.Password, u.Role, u.FullName, sql.NullString{String: u.DeviceID, Valid: u.DeviceID != ""}, u.Username)
		
		if err != nil {
			http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
			return
		}
		
		rowsAffected, _ := res.RowsAffected()
		if rowsAffected == 0 {
			http.Error(w, `{"error": "El usuario no existe"}`, http.StatusNotFound)
			return
		}
		
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Usuario actualizado exitosamente"})

	case "DELETE":
		username := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("username")))
		if username == "" {
			http.Error(w, `{"error": "El parametro username es requerido"}`, http.StatusBadRequest)
			return
		}

		// Safeguard: Prevent deleting the last administrator
		var count int
		err := db.GetDB().QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
		if err != nil {
			http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
			return
		}
		
		var role string
		err = db.GetDB().QueryRow("SELECT role FROM users WHERE username = $1", username).Scan(&role)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error": "El usuario no existe"}`, http.StatusNotFound)
			return
		}

		if role == "admin" && count <= 1 {
			http.Error(w, `{"error": "No se puede eliminar el ultimo administrador"}`, http.StatusForbidden)
			return
		}

		_, err = db.GetDB().Exec("DELETE FROM users WHERE username = $1", username)
		if err != nil {
			http.Error(w, `{"error": "Database error"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Usuario eliminado exitosamente"})

	default:
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
	}
}

// HandleUsersLogin handles credentials verification for user login
func HandleUsersLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, `{"error": "Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid request body"}`, http.StatusBadRequest)
		return
	}

	if db.GetDB() == nil {
		http.Error(w, `{"error": "Database not initialized"}`, http.StatusInternalServerError)
		return
	}

	username := strings.TrimSpace(strings.ToLower(req.Username))
	password := req.Password

	var u models.User
	var deviceID sql.NullString
	err := db.GetDB().QueryRow("SELECT username, password, role, full_name, device_id FROM users WHERE username = $1", username).
		Scan(&u.Username, &u.Password, &u.Role, &u.FullName, &deviceID)

	if err == sql.ErrNoRows || u.Password != password {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Usuario o contraseña incorrectos",
		})
		return
	} else if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "Database error",
		})
		return
	}

	if deviceID.Valid {
		u.DeviceID = deviceID.String
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"user": map[string]string{
			"username": u.Username,
			"role":     u.Role,
			"fullName": u.FullName,
			"deviceId": u.DeviceID,
		},
	})
}
