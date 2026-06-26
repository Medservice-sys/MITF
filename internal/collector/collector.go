package collector

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"mitf/internal/config"
	"mitf/internal/models"

	"golang.org/x/crypto/ssh"
)

// LogFileContent represents raw lines extracted from a file source.
type LogFileContent struct {
	Name     string
	Lines    []string
	Source   string
	DeviceID string
}

// isAllowedLogFileForBrand checks if a file is allowed based on the device brand and query mode.
func isAllowedLogFileForBrand(fileName string, brand string, mode string) bool {
	brand = strings.ToUpper(brand)
	
	switch brand {
	case "GE":
		// GE Basic logs: allowed in both online and service modes
		geBasicRegex := regexp.MustCompile(`^(gesys_aurct\.log|scanmgr\.stdout\.log|scanmgr\.stderr\.log|scanmgr\.timers\.log|recon_control\.stdout\.log|recon_control\.timers\.log|dataacq\.stats\.log|dataacq\.stderr\.log|dataacq\.stdout\.log|dataacq\.timers\.log)$`)
		if geBasicRegex.MatchString(fileName) {
			return true
		}
		// GE Service logs
		if mode == "service" {
			return fileName == "displayManager.log" || fileName == "ssw.dastool.hist"
		}
	case "SIEMENS":
		// Siemens logs (sysstate.log)
		return strings.HasPrefix(fileName, "sysstate.log")
	case "PHILIPS":
		// Philips logs (csdErrorLog)
		return fileName == "csdErrorLog"
	case "TOSHIBA", "HITACHI", "FUJIFILM":
		// Toshiba / Hitachi / Fujifilm: basic logs or generic text logs
		return strings.HasSuffix(fileName, ".log") || strings.HasSuffix(fileName, ".txt") || fileName == "error.log" || fileName == "status.log"
	default:
		// Default: allow basic log files
		return strings.HasSuffix(fileName, ".log")
	}
	return false
}

// In-memory map to store offsets of files for backward compatibility and testing.
var (
	fileOffsets   = make(map[string]int64)
	fileOffsetsMu sync.RWMutex
)

// OffsetTracker manages file byte offsets persisted in JSON files.
type OffsetTracker struct {
	filePath string
	offsets  map[string]int64
	mu       sync.RWMutex
}

// NewOffsetTracker initializes a tracker trying to load from primaryPath first, falling back to fallbackPath.
func NewOffsetTracker(primaryPath, fallbackPath string) (*OffsetTracker, error) {
	filePath := primaryPath
	if _, err := os.Stat(primaryPath); os.IsNotExist(err) {
		if _, errF := os.Stat(fallbackPath); errF == nil {
			filePath = fallbackPath
		}
	}

	tracker := &OffsetTracker{
		filePath: filePath,
		offsets:  make(map[string]int64),
	}

	data, err := os.ReadFile(filePath)
	if err == nil {
		_ = json.Unmarshal(data, &tracker.offsets)
		// Synchronize loaded offsets with package-level map for testing compatibility
		fileOffsetsMu.Lock()
		for k, v := range tracker.offsets {
			fileOffsets[k] = v
		}
		fileOffsetsMu.Unlock()
	}

	return tracker, nil
}

// Get retrieves the last read byte offset for the given file path.
func (t *OffsetTracker) Get(key string) int64 {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.offsets[key]
}

// Set updates the last read byte offset for the given file path and syncs with the package-level map.
func (t *OffsetTracker) Set(key string, val int64) {
	t.mu.Lock()
	t.offsets[key] = val
	t.mu.Unlock()

	// Update package-level map for test backward compatibility
	fileOffsetsMu.Lock()
	fileOffsets[key] = val
	fileOffsetsMu.Unlock()
}

// Save persists the current offsets to the tracker's JSON file.
func (t *OffsetTracker) Save() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	data, err := json.MarshalIndent(t.offsets, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(t.filePath, data, 0644)
}

// Collector defines the common interface for extracting log events.
type Collector interface {
	Collect(mode string) ([]LogFileContent, error)
}

// FileCollector implements local file ingestion using os.Open and Seek.
type FileCollector struct {
	dirPath string
	brand    string
	deviceID string
	tracker  *OffsetTracker
}

// NewFileCollector initializes a FileCollector with backup_offsets.json (or offsets.json).
func NewFileCollector(dirPath string, brand string) (*FileCollector, error) {
	tracker, err := NewOffsetTracker("backup_offsets.json", "offsets.json")
	if err != nil {
		return nil, err
	}
	return &FileCollector{
		dirPath:  dirPath,
		brand:    brand,
		deviceID: "default-ne-1",
		tracker:  tracker,
	}, nil
}

// Collect reads new bytes from matching local files.
func (c *FileCollector) Collect(mode string) ([]LogFileContent, error) {
	files, err := os.ReadDir(c.dirPath)
	if err != nil {
		return nil, fmt.Errorf("error reading local directory: %w", err)
	}

	var results []LogFileContent
	for _, f := range files {
		if f.IsDir() {
			continue
		}
		fileName := f.Name()
		if !isAllowedLogFileForBrand(fileName, c.brand, mode) {
			continue
		}

		fullPath := filepath.Join(c.dirPath, fileName)
		file, err := os.Open(fullPath)
		if err != nil {
			continue
		}

		stat, err := file.Stat()
		if err != nil {
			file.Close()
			continue
		}

		offset := c.tracker.Get(fullPath)
		isBinary := strings.HasSuffix(fileName, ".timers.log")
		if isBinary && offset == 0 {
			offset = 36
		}

		if stat.Size() > offset {
			_, err = file.Seek(offset, 0)
			if err != nil {
				file.Close()
				continue
			}

			// Read up to 5MB chunk
			buffer := make([]byte, 5242880)
			n, err := file.Read(buffer)
			file.Close()
			if err != nil && n == 0 {
				continue
			}

			readOut := buffer[:n]
			var cleanLines []string

			if isBinary {
				numRecords := len(readOut) / 140
				consumedBytes := int64(numRecords * 140)
				c.tracker.Set(fullPath, offset+consumedBytes)
				_ = c.tracker.Save()

				for i := 0; i < numRecords; i++ {
					record := readOut[i*140 : (i+1)*140]
					cleanLines = append(cleanLines, string(record))
				}
			} else {
				c.tracker.Set(fullPath, offset+int64(len(readOut)))
				_ = c.tracker.Save()

				rawLines := strings.Split(string(readOut), "\n")
				for _, l := range rawLines {
					line := strings.TrimRight(l, "\r")
					if line != "" {
						cleanLines = append(cleanLines, line)
					}
				}
			}

			if len(cleanLines) > 0 {
				results = append(results, LogFileContent{
					Name:     fileName,
					Lines:    cleanLines,
					Source:   fullPath,
					DeviceID: c.deviceID,
				})
			}
		} else if stat.Size() < offset {
			file.Close()
			c.tracker.Set(fullPath, 0)
			_ = c.tracker.Save()
		} else {
			file.Close()
		}
	}

	return results, nil
}

// SSHCollector implements remote log collection using ssh.Client.
type SSHCollector struct {
	host      string
	user      string
	password  string
	mode      string
	remoteDir string
	brand     string
	deviceID  string
	tracker   *OffsetTracker
}

// NewSSHCollector initializes an SSHCollector with ssh_offsets.json (or offsets.json).
func NewSSHCollector() (*SSHCollector, error) {
	tracker, err := NewOffsetTracker("ssh_offsets.json", "offsets.json")
	if err != nil {
		return nil, err
	}
	return &SSHCollector{
		host:      config.AppConfig.SSHHost,
		user:      config.AppConfig.SSHUser,
		password:  config.AppConfig.SSHPassword,
		mode:      config.AppConfig.SSHMode,
		remoteDir: config.AppConfig.RemoteLogDir,
		brand:     "GE", // Default brand for backward compatibility
		deviceID:  "default-ne-1",
		tracker:   tracker,
	}, nil
}

// NewSSHCollectorForDevice initializes an SSHCollector from a DeviceProfile.
func NewSSHCollectorForDevice(dev models.DeviceProfile) (*SSHCollector, error) {
	tracker, err := NewOffsetTracker("ssh_offsets.json", "offsets.json")
	if err != nil {
		return nil, err
	}
	return &SSHCollector{
		host:      dev.Host,
		user:      dev.User,
		password:  dev.Password,
		mode:      dev.SSHMode,
		remoteDir: dev.RemoteLogDir,
		brand:     dev.Brand,
		deviceID:  dev.ID,
		tracker:   tracker,
	}, nil
}

// Collect reads new bytes from matching remote files via SSH command piping.
func (c *SSHCollector) Collect(mode string) ([]LogFileContent, error) {
	sshConfig := &ssh.ClientConfig{
		User: c.user,
		Auth: []ssh.AuthMethod{
			ssh.Password(c.password),
			ssh.KeyboardInteractive(func(user, instruction string, questions []string, echos []bool) (answers []string, err error) {
				answers = make([]string, len(questions))
				for i := range answers {
					answers[i] = c.password
				}
				return answers, nil
			}),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	if c.mode == "legacy" {
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

	log.Printf("[SSH] Attempting TCP connection to %s...", c.host)
	conn, err := net.DialTimeout("tcp", c.host, 3*time.Second)
	if err != nil {
		log.Printf("[SSH] TCP connection failed to %s: %v", c.host, err)
		return nil, fmt.Errorf("TCP dial error: %w", err)
	}
	log.Printf("[SSH] TCP connection established to %s. Starting SSH handshake...", c.host)

	// Set deadline for the SSH handshake (5 seconds) to avoid hanging indefinitely
	_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
	sshConn, chans, reqs, err := ssh.NewClientConn(conn, c.host, sshConfig)
	if err != nil {
		conn.Close()
		log.Printf("[SSH] SSH handshake failed with %s: %v", c.host, err)
		return nil, fmt.Errorf("SSH handshake error: %w", err)
	}
	// Clear connection deadline for normal operations
	_ = conn.SetDeadline(time.Time{})
	log.Printf("[SSH] SSH connection authenticated successfully to %s as user %s", c.host, c.user)

	client := ssh.NewClient(sshConn, chans, reqs)
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to create SSH session: %w", err)
	}
	defer session.Close()

	var lsOutput bytes.Buffer
	session.Stdout = &lsOutput
	if err := session.Run(fmt.Sprintf("ls -1 %s", c.remoteDir)); err != nil {
		return nil, fmt.Errorf("error running ls: %w", err)
	}

	files := strings.Split(lsOutput.String(), "\n")
	var results []LogFileContent

	for _, file := range files {
		fileName := strings.TrimSpace(file)
		if fileName == "" || !isAllowedLogFileForBrand(fileName, c.brand, mode) {
			continue
		}

		fullPath := fmt.Sprintf("%s/%s", c.remoteDir, fileName)

		sizeSession, err := client.NewSession()
		if err != nil {
			continue
		}

		cmdSize := fmt.Sprintf("wc -c < %s", fullPath)
		sizeOut, err := sizeSession.CombinedOutput(cmdSize)
		sizeSession.Close()
		if err != nil {
			continue
		}

		remoteSize, err := strconv.ParseInt(strings.TrimSpace(string(sizeOut)), 10, 64)
		if err != nil {
			continue
		}

		offset := c.tracker.Get(fullPath)
		isBinary := strings.HasSuffix(fileName, ".timers.log")
		if isBinary && offset == 0 {
			offset = 36
		}

		if remoteSize > offset {
			readSession, err := client.NewSession()
			if err != nil {
				continue
			}

			cmdRead := fmt.Sprintf("tail -c +%d %s | head -c 5242880", offset+1, fullPath)
			readOut, err := readSession.CombinedOutput(cmdRead)
			readSession.Close()
			if err != nil && len(readOut) == 0 {
				continue
			}

			var cleanLines []string
			if isBinary {
				numRecords := len(readOut) / 140
				consumedBytes := int64(numRecords * 140)
				c.tracker.Set(fullPath, offset+consumedBytes)
				_ = c.tracker.Save()

				for i := 0; i < numRecords; i++ {
					record := readOut[i*140 : (i+1)*140]
					cleanLines = append(cleanLines, string(record))
				}
			} else {
				c.tracker.Set(fullPath, offset+int64(len(readOut)))
				_ = c.tracker.Save()

				rawLines := strings.Split(string(readOut), "\n")
				for _, l := range rawLines {
					line := strings.TrimRight(l, "\r")
					if line != "" {
						cleanLines = append(cleanLines, line)
					}
				}
			}

			if len(cleanLines) > 0 {
				results = append(results, LogFileContent{
					Name:     fileName,
					Lines:    cleanLines,
					Source:   fullPath,
					DeviceID: c.deviceID,
				})
			}
		} else if remoteSize < offset {
			c.tracker.Set(fullPath, 0)
			_ = c.tracker.Save()
		}
	}

	return results, nil
}

// CollectTomographLogs acts as the centralized wrapper matching configuration to appropriate Collector.
func CollectTomographLogs(mode string, profiles []models.DeviceProfile) ([]LogFileContent, error) {
	collectorType := os.Getenv("CT_COLLECTOR_TYPE")
	if collectorType == "local" || config.AppConfig.SSHHost == "local" {
		localDir := config.AppConfig.RemoteLogDir
		if localDir == "" {
			localDir = "data/local_logs"
		}
		col, err := NewFileCollector(localDir, "GE")
		if err != nil {
			return nil, err
		}
		return col.Collect(mode)
	}

	var allResults []LogFileContent

	// If no profiles provided, fallback to the legacy single CT config only if SSHHost is set
	if len(profiles) == 0 {
		if config.AppConfig.SSHHost == "" {
			log.Println("[POLLER] No active device profiles to monitor. Please add devices in the Settings panel.")
			return nil, nil
		}
		col, err := NewSSHCollector()
		if err != nil {
			return nil, err
		}
		return col.Collect(mode)
	}

	// Poll all active device profiles
	for _, dev := range profiles {
		if !dev.Active {
			continue
		}

		log.Printf("[POLLER] Starting log collection from NE: %s (%s, Brand: %s)", dev.Name, dev.Host, dev.Brand)
		col, err := NewSSHCollectorForDevice(dev)
		if err != nil {
			log.Printf("[POLLER] Error creating SSH Collector for NE %s: %v", dev.Name, err)
			continue
		}

		results, err := col.Collect(mode)
		if err != nil {
			log.Printf("[POLLER] Error collecting logs from NE %s: %v", dev.Name, err)
			continue
		}

		allResults = append(allResults, results...)
	}

	return allResults, nil
}
