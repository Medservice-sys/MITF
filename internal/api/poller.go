package api

import (
	"log"
	"os"
	"strings"
	"time"

	"mitf/internal/collector"
	"mitf/internal/models"
	"mitf/internal/parser"
)

// StartPollingEngine starts the background loop fetching tomograph logs
func StartPollingEngine() {
	log.Printf("[POLLER] Starting background SSH polling engine (interval: 15s)...")

	// On startup, if Store.Events is empty, clear offset tracking files so the collector builds the cache from the beginning
	Store.mu.RLock()
	emptyStore := len(Store.Events) == 0
	Store.mu.RUnlock()
	if emptyStore {
		log.Printf("[POLLER] Store is empty on startup. Resetting offsets to read full logs...")
		_ = os.WriteFile("ssh_offsets.json", []byte("{}"), 0644)
		_ = os.WriteFile("offsets.json", []byte("{}"), 0644)
		_ = os.WriteFile("backup_offsets.json", []byte("{}"), 0644)
	}

	// Helper function to run a single poll cycle
	runPollCycle := func() {
		log.Printf("[POLLER] Starting log poll cycle...")
		Store.mu.Lock()
		Store.Status.LastCheckTime = time.Now()
		Store.mu.Unlock()

		OperationModeMu.RLock()
		mode := OperationMode
		OperationModeMu.RUnlock()

		DeviceProfilesMu.RLock()
		profilesCopy := make([]models.DeviceProfile, len(DeviceProfiles))
		copy(profilesCopy, DeviceProfiles)
		DeviceProfilesMu.RUnlock()

		// Call SSH collector with active profiles
		contents, err := collector.CollectTomographLogs(mode, profilesCopy)

		Store.mu.Lock()
		if err != nil {
			log.Printf("[POLLER] Poll cycle error: %v", err)
			Store.Status.Status = "ERROR"
			Store.Status.LastError = err.Error()
		} else {
			log.Printf("[POLLER] Poll cycle completed successfully. Fetched %d logs.", len(contents))
			Store.Status.Status = "CONNECTED"
			Store.Status.LastError = ""

			// Parse and add fetched events using modular parsers
			totalNewEvents := 0
			for _, f := range contents {
				var p parser.LogParser

				if strings.Contains(f.Name, "gesys_aurct") {
					p = &parser.GesysParser{}
				} else if strings.Contains(f.Name, "scanmgr") {
					p = &parser.ScanMgrParser{}
				} else if strings.Contains(f.Name, "device_eventlog") {
					p = &parser.DeviceParser{}
				} else if strings.Contains(f.Name, "recon") {
					p = &parser.ReconParser{}
				} else if strings.Contains(f.Name, "sysstate") {
					p = &parser.SysStateParser{}
				} else if strings.Contains(f.Name, "displayManager") {
					p = &parser.DisplayManagerParser{}
				} else if strings.Contains(f.Name, "csdError") {
					p = &parser.CsdErrorParser{}
				} else if strings.Contains(f.Name, "ssw.dastool.hist") {
					p = &parser.DasToolHistParser{}
				} else {
					// Skip files without a defined parser
					continue
				}

				newEvents := p.Parse(f.Lines, f.Name)
				if len(newEvents) > 0 {
					Store.Events = append(Store.Events, newEvents...)
					totalNewEvents += len(newEvents)
				}
			}
			if totalNewEvents > 0 {
				log.Printf("[POLLER] Parsed and added %d new events to the store. Total events in memory: %d", totalNewEvents, len(Store.Events))
			}
		}

		// Keep log database size bounded in memory
		if len(Store.Events) > 500000 {
			Store.Events = Store.Events[len(Store.Events)-500000:]
		}

		// Copy events slice to pass safely to UpdateYANGTreeFromEvents without holding the lock
		eventsCopy := make([]models.UnifiedLogEvent, len(Store.Events))
		copy(eventsCopy, Store.Events)

		Store.mu.Unlock()

		// Dynamically auto-detect device model / sw / serial from events
		UpdateYANGTreeFromEvents(eventsCopy)
	}

	go func() {
		// Run first poll cycle immediately on startup
		runPollCycle()

		for {
			DeviceProfilesMu.RLock()
			refreshInterval := GlobalRefreshSec
			DeviceProfilesMu.RUnlock()

			if refreshInterval < 5 {
				refreshInterval = 15
			}

			time.Sleep(time.Duration(refreshInterval) * time.Second)
			runPollCycle()
		}
	}()
}
