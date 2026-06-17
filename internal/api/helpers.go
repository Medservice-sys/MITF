package api

import (
	"net/http"
	"time"

	"mitf/internal/models"
)

// parseDateRange extracts from and to dates, defaulting to the latest day of data if empty
func parseDateRange(r *http.Request, events []models.UnifiedLogEvent) (time.Time, time.Time, bool) {
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")

	var fromTime, toTime time.Time
	var hasRange bool

	if fromStr != "" || toStr != "" {
		if fromStr != "" {
			if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
				fromTime = t
			}
		}
		if toStr != "" {
			if t, err := time.Parse(time.RFC3339, toStr); err == nil {
				toTime = t
			}
		}
		hasRange = true
	} else if len(events) > 0 {
		var latestTime time.Time
		for _, ev := range events {
			if ev.Timestamp.After(latestTime) {
				latestTime = ev.Timestamp
			}
		}
		if !latestTime.IsZero() {
			y, m, d := latestTime.Date()
			loc := latestTime.Location()
			fromTime = time.Date(y, m, d, 0, 0, 0, 0, loc)
			toTime = time.Date(y, m, d, 23, 59, 59, 999999999, loc)
			hasRange = true
		}
	}

	return fromTime, toTime, hasRange
}
