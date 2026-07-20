package api

import (
	"net/http"
	"time"

	"mitf/internal/models"
)

// parseDateRange extracts from and to dates based on query params from Header filters
func parseDateRange(r *http.Request, events []models.UnifiedLogEvent) (time.Time, time.Time, bool) {
	rangeParam := r.URL.Query().Get("range")
	fromStr := r.URL.Query().Get("from")
	if fromStr == "" {
		fromStr = r.URL.Query().Get("startDate")
	}
	toStr := r.URL.Query().Get("to")
	if toStr == "" {
		toStr = r.URL.Query().Get("endDate")
	}

	// 1. Explicitly "all" means no date filtering
	if rangeParam == "all" {
		return time.Time{}, time.Time{}, false
	}

	// Reference time for relative ranges
	now := time.Now()
	referenceTime := now
	for _, ev := range events {
		if ev.Timestamp.After(referenceTime) {
			referenceTime = ev.Timestamp
		}
	}

	var fromTime, toTime time.Time

	switch rangeParam {
	case "today":
		y, m, d := referenceTime.Date()
		loc := referenceTime.Location()
		fromTime = time.Date(y, m, d, 0, 0, 0, 0, loc)
		toTime = time.Date(y, m, d, 23, 59, 59, 999999999, loc)
		return fromTime, toTime, true

	case "24h":
		fromTime = referenceTime.Add(-24 * time.Hour)
		toTime = referenceTime
		return fromTime, toTime, true

	case "7d":
		fromTime = referenceTime.Add(-7 * 24 * time.Hour)
		toTime = referenceTime
		return fromTime, toTime, true

	case "30d":
		fromTime = referenceTime.Add(-30 * 24 * time.Hour)
		toTime = referenceTime
		return fromTime, toTime, true

	case "custom":
		hasCustom := false
		if fromStr != "" {
			if t, err := time.Parse("2006-01-02", fromStr); err == nil {
				fromTime = t
				hasCustom = true
			} else if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
				fromTime = t
				hasCustom = true
			}
		}
		if toStr != "" {
			if t, err := time.Parse("2006-01-02", toStr); err == nil {
				y, m, d := t.Date()
				toTime = time.Date(y, m, d, 23, 59, 59, 999999999, t.Location())
				hasCustom = true
			} else if t, err := time.Parse(time.RFC3339, toStr); err == nil {
				toTime = t
				hasCustom = true
			}
		}
		if hasCustom {
			return fromTime, toTime, true
		}
	}

	// 2. Direct string fallback
	if fromStr != "" || toStr != "" {
		if fromStr != "" {
			if t, err := time.Parse("2006-01-02", fromStr); err == nil {
				fromTime = t
			} else if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
				fromTime = t
			}
		}
		if toStr != "" {
			if t, err := time.Parse("2006-01-02", toStr); err == nil {
				y, m, d := t.Date()
				toTime = time.Date(y, m, d, 23, 59, 59, 999999999, t.Location())
			} else if t, err := time.Parse(time.RFC3339, toStr); err == nil {
				toTime = t
			}
		}
		return fromTime, toTime, true
	}

	// Default: return no date filter
	return time.Time{}, time.Time{}, false
}
