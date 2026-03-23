package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/estate-docs/go-backend/internal/utils"
)

type RateLimiter struct {
	maxRequests   int
	windowSeconds int
	requests      map[string][]time.Time
	mu            sync.Mutex
}

func NewRateLimiter(maxRequests, windowSeconds int) *RateLimiter {
	return &RateLimiter{
		maxRequests:   maxRequests,
		windowSeconds: windowSeconds,
		requests:      make(map[string][]time.Time),
	}
}

func (rl *RateLimiter) Check(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	cutoff := time.Now().Add(-time.Duration(rl.windowSeconds) * time.Second)
	var valid []time.Time
	for _, t := range rl.requests[key] {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}
	rl.requests[key] = valid

	if len(valid) >= rl.maxRequests {
		return false
	}
	rl.requests[key] = append(rl.requests[key], time.Now())
	return true
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := GetClientIP(r)
		if !rl.Check(ip) {
			utils.Error(w, http.StatusTooManyRequests, "Too many requests. Please try again later.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func GetClientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		return forwarded
	}
	return r.RemoteAddr
}

var AuthRateLimiter = NewRateLimiter(10, 60)
