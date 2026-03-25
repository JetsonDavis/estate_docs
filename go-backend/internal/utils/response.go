package utils

import (
	"encoding/json"
	"net/http"
)

func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"detail": message})
}

func DecodeJSON(r *http.Request, dst interface{}) error {
	return json.NewDecoder(r.Body).Decode(dst)
}

func QueryInt(r *http.Request, key string, defaultVal int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return defaultVal
	}
	var i int
	if _, err := json.Number(v).Int64(); err == nil {
		n, _ := json.Number(v).Int64()
		i = int(n)
	} else {
		return defaultVal
	}
	return i
}

func QueryString(r *http.Request, key string, defaultVal string) string {
	v := r.URL.Query().Get(key)
	if v == "" {
		return defaultVal
	}
	return v
}

func QueryBool(r *http.Request, key string, defaultVal bool) bool {
	v := r.URL.Query().Get(key)
	if v == "" {
		return defaultVal
	}
	return v == "true" || v == "1"
}
