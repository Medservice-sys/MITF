package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	sslmode := os.Getenv("DB_SSLMODE")

	if host == "" {
		log.Println("[DB] Warning: DB_HOST is not set, skipping database initialization")
		return
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)

	var err error
	
	// Intenta conectar con reintentos
	for i := 0; i < 5; i++ {
		DB, err = sql.Open("postgres", dsn)
		if err == nil {
			err = DB.Ping()
			if err == nil {
				log.Println("[DB] Successfully connected to PostgreSQL")
				return
			}
		}
		log.Printf("[DB] Attempt %d: Failed to connect to DB, retrying in 2 seconds...\n", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("[DB] Fatal: Could not connect to PostgreSQL after multiple attempts: %v", err)
	}
}

func GetDB() *sql.DB {
	return DB
}
