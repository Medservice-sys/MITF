package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds all the centralized application configurations
type Config struct {
	ServerPort      string
	SSHHost         string
	SSHUser         string
	SSHPassword     string
	SSHMode         string
	RemoteLogDir    string
}

// AppConfig is the global configuration instance
var AppConfig *Config

// LoadConfig initializes the configuration from environment variables.
// It tries to load a .env file locally, but gracefully ignores if missing (for production).
func LoadConfig() error {
	_ = godotenv.Load() // Ignore error, as .env might not exist in production

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8080" // Default port if missing
	}

	mode := os.Getenv("CT_SSH_MODE")
	if mode == "" {
		mode = "legacy" // Default for backward compatibility
	}

	appConfig := &Config{
		ServerPort:   port,
		SSHHost:      os.Getenv("CT_SSH_HOST"),
		SSHUser:      os.Getenv("CT_SSH_USER"),
		SSHPassword:  os.Getenv("CT_SSH_PASSWORD"),
		SSHMode:      mode,
		RemoteLogDir: os.Getenv("CT_REMOTE_LOG_DIR"),
	}

	AppConfig = appConfig
	return nil
}
