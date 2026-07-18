package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"os"

	"mitf/internal/db"
	"mitf/internal/models"
)

var (
	FTPPort = 2121
	FTPUser = "admin"
	FTPPass = "admin"

	RoiCriticalAvoided    = 15000.0
	RoiWarningAvoided     = 4000.0
	RoiMinorAvoided       = 1000.0
	RoiLaborCost          = 200.0
	RoiCalibrationCost    = 400.0
	RoiPartCost           = 800.0
)

// LoadConfigOnStartup loads operation mode and refresh interval from DB, with fallback to config.json
func LoadConfigOnStartup() {
	if db.GetDB() == nil {
		log.Println("[CONFIG] WARNING: Database connection is nil, system_config table cannot be initialized.")
		return
	}

	createTableQuery := `
	CREATE TABLE IF NOT EXISTS system_config (
		id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
		operation_mode VARCHAR(50) NOT NULL,
		refresh_interval INT NOT NULL,
		ftp_port INT NOT NULL DEFAULT 2121,
		ftp_username VARCHAR(255) NOT NULL DEFAULT 'admin',
		ftp_password VARCHAR(255) NOT NULL DEFAULT 'admin',
		roi_critical_avoided DOUBLE PRECISION NOT NULL DEFAULT 15000.0,
		roi_warning_avoided DOUBLE PRECISION NOT NULL DEFAULT 4000.0,
		roi_minor_avoided DOUBLE PRECISION NOT NULL DEFAULT 1000.0,
		roi_labor_cost DOUBLE PRECISION NOT NULL DEFAULT 200.0,
		roi_calibration_cost DOUBLE PRECISION NOT NULL DEFAULT 400.0,
		roi_part_cost DOUBLE PRECISION NOT NULL DEFAULT 800.0
	);`

	_, err := db.GetDB().Exec(createTableQuery)
	if err != nil {
		log.Fatalf("[CONFIG] Error creating system_config table: %v", err)
	}

	// Upgrade schema if running on existing database
	alterQueries := []string{
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS ftp_port INT NOT NULL DEFAULT 2121;`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS ftp_username VARCHAR(255) NOT NULL DEFAULT 'admin';`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS ftp_password VARCHAR(255) NOT NULL DEFAULT 'admin';`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS roi_critical_avoided DOUBLE PRECISION NOT NULL DEFAULT 15000.0;`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS roi_warning_avoided DOUBLE PRECISION NOT NULL DEFAULT 4000.0;`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS roi_minor_avoided DOUBLE PRECISION NOT NULL DEFAULT 1000.0;`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS roi_labor_cost DOUBLE PRECISION NOT NULL DEFAULT 200.0;`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS roi_calibration_cost DOUBLE PRECISION NOT NULL DEFAULT 400.0;`,
		`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS roi_part_cost DOUBLE PRECISION NOT NULL DEFAULT 800.0;`,
	}
	for _, q := range alterQueries {
		_, _ = db.GetDB().Exec(q)
	}

	var mode string
	var refresh int
	var fPort int
	var fUser, fPass string
	var rCritical, rWarning, rMinor, rLabor, rCalib, rPart float64

	err = db.GetDB().QueryRow(`
		SELECT operation_mode, refresh_interval, ftp_port, ftp_username, ftp_password,
		       roi_critical_avoided, roi_warning_avoided, roi_minor_avoided,
		       roi_labor_cost, roi_calibration_cost, roi_part_cost
		FROM system_config WHERE id = 1
	`).Scan(&mode, &refresh, &fPort, &fUser, &fPass, &rCritical, &rWarning, &rMinor, &rLabor, &rCalib, &rPart)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("[CONFIG] No config found in DB. Checking data/config.json...")
			defaultMode := "online"
			defaultRefresh := 15

			file, err := os.ReadFile("data/config.json")
			if err == nil {
				var cfg struct {
					OperationMode   string `json:"operationMode"`
					RefreshInterval int    `json:"refreshInterval"`
				}
				if json.Unmarshal(file, &cfg) == nil {
					if cfg.OperationMode != "" {
						defaultMode = cfg.OperationMode
					}
					if cfg.RefreshInterval >= 5 {
						defaultRefresh = cfg.RefreshInterval
					}
				}
			}

			// Insert into DB
			_, err = db.GetDB().Exec(`
				INSERT INTO system_config (id, operation_mode, refresh_interval, ftp_port, ftp_username, ftp_password,
				                           roi_critical_avoided, roi_warning_avoided, roi_minor_avoided,
				                           roi_labor_cost, roi_calibration_cost, roi_part_cost) 
				VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
				defaultMode, defaultRefresh, 2121, "admin", "admin", 15000.0, 4000.0, 1000.0, 200.0, 400.0, 800.0)
			if err != nil {
				log.Printf("[CONFIG] Error inserting default config to DB: %v", err)
			}
			mode = defaultMode
			refresh = defaultRefresh
			fPort = 2121
			fUser = "admin"
			fPass = "admin"
			rCritical = 15000.0
			rWarning = 4000.0
			rMinor = 1000.0
			rLabor = 200.0
			rCalib = 400.0
			rPart = 800.0
		} else {
			log.Printf("[CONFIG] Error reading config from DB: %v", err)
			return
		}
	}

	OperationModeMu.Lock()
	OperationMode = mode
	OperationModeMu.Unlock()

	DeviceProfilesMu.Lock()
	GlobalRefreshSec = refresh
	DeviceProfilesMu.Unlock()

	FTPPort = fPort
	FTPUser = fUser
	FTPPass = fPass

	RoiCriticalAvoided = rCritical
	RoiWarningAvoided = rWarning
	RoiMinorAvoided = rMinor
	RoiLaborCost = rLabor
	RoiCalibrationCost = rCalib
	RoiPartCost = rPart

	log.Printf("[CONFIG] Loaded from DB: operationMode=%s, refreshInterval=%ds, ftpPort=%d, ftpUser=%s, roiCritical=%.1f", mode, refresh, fPort, fUser, rCritical)
}

// LoadDevicesOnStartup loads monitored devices from DB, with fallback to devices.json
func LoadDevicesOnStartup() {
	if db.GetDB() == nil {
		log.Println("[DEVICES] WARNING: Database connection is nil, devices table cannot be initialized.")
		return
	}

	createTableQuery := `
	CREATE TABLE IF NOT EXISTS devices (
		id VARCHAR(255) PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		host VARCHAR(255) NOT NULL,
		username VARCHAR(255) NOT NULL,
		password VARCHAR(255) NOT NULL,
		brand VARCHAR(50) NOT NULL,
		remote_log_dir VARCHAR(255) NOT NULL,
		ssh_mode VARCHAR(50) NOT NULL,
		active BOOLEAN NOT NULL
	);`

	_, err := db.GetDB().Exec(createTableQuery)
	if err != nil {
		log.Fatalf("[DEVICES] Error creating devices table: %v", err)
	}

	var count int
	err = db.GetDB().QueryRow("SELECT COUNT(*) FROM devices").Scan(&count)
	if err != nil {
		log.Fatalf("[DEVICES] Error checking devices count: %v", err)
	}

	if count == 0 {
		var list []models.DeviceProfile

		// Migrate from devices.json
		data, err := os.ReadFile("data/devices.json")
		if err == nil {
			_ = json.Unmarshal(data, &list)
		}

		if len(list) == 0 {
			// Migrate from env
			host := os.Getenv("CT_SSH_HOST")
			if host != "" {
				brand := "GE"
				user := os.Getenv("CT_SSH_USER")
				pass := os.Getenv("CT_SSH_PASSWORD")
				dir := os.Getenv("CT_REMOTE_LOG_DIR")
				mode := os.Getenv("CT_SSH_MODE")
				if mode == "" {
					mode = "legacy"
				}

				defaultDev := models.DeviceProfile{
					ID:           "default-ne-1",
					Name:         "GE Tomógrafo Principal",
					Host:         host,
					User:         user,
					Password:     pass,
					Brand:        brand,
					RemoteLogDir: dir,
					SSHMode:      mode,
					Active:       true,
				}
				list = []models.DeviceProfile{defaultDev}
			}
		}

		for _, dev := range list {
			_, err := db.GetDB().Exec(`INSERT INTO devices (id, name, host, username, password, brand, remote_log_dir, ssh_mode, active) 
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
				dev.ID, dev.Name, dev.Host, dev.User, dev.Password, dev.Brand, dev.RemoteLogDir, dev.SSHMode, dev.Active)
			if err != nil {
				log.Printf("[DEVICES] Error migrating device %s to DB: %v", dev.Name, err)
			}
		}
		log.Printf("[DEVICES] Migrated %d devices to database", len(list))
	}

	// Now read all from DB
	rows, err := db.GetDB().Query("SELECT id, name, host, username, password, brand, remote_log_dir, ssh_mode, active FROM devices")
	if err != nil {
		log.Printf("[DEVICES] Error querying devices: %v", err)
		return
	}
	defer rows.Close()

	var loadedDevices []models.DeviceProfile
	for rows.Next() {
		var dev models.DeviceProfile
		err := rows.Scan(&dev.ID, &dev.Name, &dev.Host, &dev.User, &dev.Password, &dev.Brand, &dev.RemoteLogDir, &dev.SSHMode, &dev.Active)
		if err != nil {
			log.Printf("[DEVICES] Error scanning device: %v", err)
			continue
		}
		loadedDevices = append(loadedDevices, dev)
	}

	DeviceProfilesMu.Lock()
	DeviceProfiles = loadedDevices
	DeviceProfilesMu.Unlock()

	log.Printf("[DEVICES] Loaded %d devices from database", len(loadedDevices))
}

// SaveConfigToDB saves the general config and devices list to PostgreSQL
func SaveConfigToDB(mode string, refresh int, devices []models.DeviceProfile, rCritical, rWarning, rMinor, rLabor, rCalib, rPart float64) error {
	if db.GetDB() == nil {
		return nil
	}

	tx, err := db.GetDB().Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Update or insert system_config (keeping existing FTP columns)
	_, err = tx.Exec(`INSERT INTO system_config (id, operation_mode, refresh_interval,
	                                           roi_critical_avoided, roi_warning_avoided, roi_minor_avoided,
	                                           roi_labor_cost, roi_calibration_cost, roi_part_cost) 
		VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (id) DO UPDATE SET 
			operation_mode = EXCLUDED.operation_mode, 
			refresh_interval = EXCLUDED.refresh_interval,
			roi_critical_avoided = EXCLUDED.roi_critical_avoided,
			roi_warning_avoided = EXCLUDED.roi_warning_avoided,
			roi_minor_avoided = EXCLUDED.roi_minor_avoided,
			roi_labor_cost = EXCLUDED.roi_labor_cost,
			roi_calibration_cost = EXCLUDED.roi_calibration_cost,
			roi_part_cost = EXCLUDED.roi_part_cost`,
		mode, refresh, rCritical, rWarning, rMinor, rLabor, rCalib, rPart)
	if err != nil {
		return err
	}

	// Update devices table: clear and re-insert
	_, err = tx.Exec("DELETE FROM devices")
	if err != nil {
		return err
	}

	for _, dev := range devices {
		_, err := tx.Exec(`INSERT INTO devices (id, name, host, username, password, brand, remote_log_dir, ssh_mode, active) 
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			dev.ID, dev.Name, dev.Host, dev.User, dev.Password, dev.Brand, dev.RemoteLogDir, dev.SSHMode, dev.Active)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// SaveFTPConfigToDB updates FTP settings in PostgreSQL
func SaveFTPConfigToDB(port int, user, password string) error {
	if db.GetDB() == nil {
		return nil
	}

	_, err := db.GetDB().Exec(`INSERT INTO system_config (id, operation_mode, refresh_interval, ftp_port, ftp_username, ftp_password) 
		VALUES (1, 'online', 15, $1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET ftp_port = EXCLUDED.ftp_port, ftp_username = EXCLUDED.ftp_username, ftp_password = EXCLUDED.ftp_password`,
		port, user, password)
	if err != nil {
		return err
	}

	FTPPort = port
	FTPUser = user
	FTPPass = password

	return nil
}
