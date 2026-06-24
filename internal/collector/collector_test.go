package collector

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net"
	"os"
	"strings"
	"testing"

	"mitf/internal/config"
	"golang.org/x/crypto/ssh"
)

// startMockSSHServer launches a minimal, local SSH server on a random port.
func startMockSSHServer(t *testing.T) (string, func()) {
	// Generate a small RSA private key for fast startup
	key, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatalf("Failed to generate private key: %v", err)
	}
	privateDer := x509.MarshalPKCS1PrivateKey(key)
	pemBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privateDer,
	}
	privatePEM := pem.EncodeToMemory(pemBlock)

	signer, err := ssh.ParsePrivateKey(privatePEM)
	if err != nil {
		t.Fatalf("Failed to parse private key: %v", err)
	}

	sshConfig := &ssh.ServerConfig{
		PasswordCallback: func(conn ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
			if conn.User() == "testuser" && string(password) == "testpass" {
				return nil, nil
			}
			return nil, fmt.Errorf("password rejected")
		},
	}
	sshConfig.AddHostKey(signer)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("Failed to listen: %v", err)
	}
	addr := listener.Addr().String()

	shutdown := make(chan struct{})

	go func() {
		for {
			nConn, err := listener.Accept()
			if err != nil {
				select {
				case <-shutdown:
					return
				default:
					continue
				}
			}

			go func(conn net.Conn) {
				defer conn.Close()
				sConn, chans, reqs, err := ssh.NewServerConn(conn, sshConfig)
				if err != nil {
					return
				}
				defer sConn.Close()

				go ssh.DiscardRequests(reqs)

				for newChannel := range chans {
					if newChannel.ChannelType() != "session" {
						newChannel.Reject(ssh.UnknownChannelType, "unknown channel type")
						continue
					}

					channel, requests, err := newChannel.Accept()
					if err != nil {
						return
					}

					go func(in <-chan *ssh.Request, ch ssh.Channel) {
						defer ch.Close()
						for req := range in {
							if req.Type == "exec" {
								var payload struct {
									Value string
								}
								ssh.Unmarshal(req.Payload, &payload)
								command := payload.Value

								var response string
								if strings.Contains(command, "ls -1") {
									response = "scanmgr.stdout.log\n"
								} else if strings.Contains(command, "wc -c") {
									// Simulate file size of 30 bytes
									response = "30\n"
								} else if strings.Contains(command, "tail -c") {
									// Return 18 bytes of log text
									response = "line1\nline2\nline3\n"
								}

								ch.Write([]byte(response))
								req.Reply(true, nil)
								
								// Send exit status
								status := struct{ Status uint32 }{Status: 0}
								ch.SendRequest("exit-status", false, ssh.Marshal(&status))
								return
							}
						}
					}(requests, channel)
				}
			}(nConn)
		}
	}()

	cleanup := func() {
		close(shutdown)
		listener.Close()
	}

	return addr, cleanup
}

func TestCollectTomographLogs(t *testing.T) {
	// Clean up previous runs' persisted and in-memory offset states
	fileOffsetsMu.Lock()
	fileOffsets = make(map[string]int64)
	fileOffsetsMu.Unlock()
	_ = os.Remove("ssh_offsets.json")
	_ = os.Remove("offsets.json")
	_ = os.Remove("backup_offsets.json")

	addr, cleanup := startMockSSHServer(t)
	defer cleanup()

	// Inject the mock server settings into the Global Config
	config.AppConfig = &config.Config{
		SSHHost:      addr,
		SSHUser:      "testuser",
		SSHPassword:  "testpass",
		RemoteLogDir: "/tmp/mocklogs",
		SSHMode:      "modern",
	}

	// 1. Initial collection
	results, err := CollectTomographLogs("online", nil)
	if err != nil {
		t.Fatalf("First collection failed: %v", err)
	}

	if len(results) != 1 {
		t.Fatalf("expected 1 file result, got %d", len(results))
	}

	if results[0].Name != "scanmgr.stdout.log" {
		t.Errorf("expected scanmgr.stdout.log, got %s", results[0].Name)
	}

	expectedLines := []string{"line1", "line2", "line3"}
	if len(results[0].Lines) != len(expectedLines) {
		t.Fatalf("expected %d lines, got %d", len(expectedLines), len(results[0].Lines))
	}
	for i, line := range results[0].Lines {
		if line != expectedLines[i] {
			t.Errorf("expected line %d to be %q, got %q", i, expectedLines[i], line)
		}
	}

	// 2. Verify offset was updated in map
	fullPath := "/tmp/mocklogs/scanmgr.stdout.log"
	fileOffsetsMu.RLock()
	offset := fileOffsets[fullPath]
	fileOffsetsMu.RUnlock()

	if offset != 18 { // "line1\nline2\nline3\n" is 18 bytes
		t.Errorf("expected offset 18, got %d", offset)
	}
}

func TestIsAllowedLogFile(t *testing.T) {
	tests := []struct {
		fileName string
		brand    string
		mode     string
		allowed  bool
	}{
		// GE Basic files - always allowed
		{"gesys_aurct.log", "GE", "online", true},
		{"gesys_aurct.log", "GE", "service", true},
		{"scanmgr.stdout.log", "GE", "online", true},
		{"scanmgr.stdout.log", "GE", "service", true},
		{"dataacq.stats.log", "GE", "online", true},
		{"dataacq.stats.log", "GE", "service", true},

		// GE Advanced Service / Other vendors - only allowed in service mode
		{"displayManager.log", "GE", "online", false},
		{"displayManager.log", "GE", "service", true},
		{"sysstate.log", "Siemens", "online", true},
		{"sysstate.log", "Siemens", "service", true},
		{"csdErrorLog", "Philips", "online", true},
		{"csdErrorLog", "Philips", "service", true},

		// Random files - never allowed
		{"random.log", "GE", "online", false},
		{"random.log", "GE", "service", false},
	}

	for _, tt := range tests {
		res := isAllowedLogFileForBrand(tt.fileName, tt.brand, tt.mode)
		if res != tt.allowed {
			t.Errorf("isAllowedLogFileForBrand(%q, %q, %q) expected %v, got %v", tt.fileName, tt.brand, tt.mode, tt.allowed, res)
		}
	}
}

