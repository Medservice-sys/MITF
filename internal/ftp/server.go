package ftp

import (
	"log"
	"os"
	"sync"

	filedriver "github.com/goftp/file-driver"
	"github.com/goftp/server"
)

var (
	ftpServer *server.Server
	ftpMu     sync.Mutex
)

func StartFTPServer(port int, user, password string) {
	ftpMu.Lock()
	defer ftpMu.Unlock()

	if ftpServer != nil {
		log.Println("[FTP] Stopping existing FTP server...")
		_ = ftpServer.Shutdown()
	}

	ftpDir := "data/ftp_logs"
	if err := os.MkdirAll(ftpDir, 0755); err != nil {
		log.Fatalf("[FTP] Error creating ftp directory: %v", err)
	}

	factory := &filedriver.FileDriverFactory{
		RootPath: ftpDir,
		Perm:     server.NewSimplePerm(user, password),
	}

	opts := &server.ServerOpts{
		Factory:  factory,
		Port:     port,
		Hostname: "0.0.0.0",
		Auth: &server.SimpleAuth{
			Name:     user,
			Password: password,
		},
	}

	ftpServer = server.NewServer(opts)

	go func() {
		log.Printf("[FTP] Starting internal FTP server on port %d...", port)
		if err := ftpServer.ListenAndServe(); err != nil {
			log.Printf("[FTP] Server closed/error: %v", err)
		}
	}()
}
