// methods-idempotency-server.go
// Demo: safe/idempotent GET & PUT vs non-idempotent POST, plus Idempotency-Key.
//
//   go run methods-idempotency-server.go
//   curl -s http://127.0.0.1:8090/items/1
//   curl -s -X PUT -H 'Content-Type: application/json' -d '{"name":"Ada"}' http://127.0.0.1:8090/items/1
//   curl -s -X POST -H 'Content-Type: application/json' -H 'Idempotency-Key: k1' -d '{"name":"Bob"}' http://127.0.0.1:8090/items

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
)

type Item struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type idemRecord struct {
	Status int
	Body   []byte
}

var (
	mu       sync.Mutex
	items    = map[string]Item{"1": {ID: "1", Name: "seed"}}
	nextID   = 2
	idempot  = map[string]idemRecord{}
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func main() {
	mux := http.NewServeMux()

	// Safe + idempotent
	mux.HandleFunc("GET /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		mu.Lock()
		item, ok := items[id]
		mu.Unlock()
		if !ok {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		writeJSON(w, http.StatusOK, item)
	})

	// Unsafe but idempotent: replace entire resource
	mux.HandleFunc("PUT /items/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var body struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		mu.Lock()
		items[id] = Item{ID: id, Name: body.Name}
		out := items[id]
		mu.Unlock()
		writeJSON(w, http.StatusOK, out)
	})

	// Unsafe & not idempotent by default — made safe to retry with Idempotency-Key
	mux.HandleFunc("POST /items", func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("Idempotency-Key")
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "read body"})
			return
		}

		fingerprint := ""
		if key != "" {
			sum := sha256.Sum256(append([]byte(key+"|"), raw...))
			fingerprint = hex.EncodeToString(sum[:])
			mu.Lock()
			if rec, ok := idempot[fingerprint]; ok {
				mu.Unlock()
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Idempotent-Replay", "true")
				w.WriteHeader(rec.Status)
				_, _ = w.Write(rec.Body)
				return
			}
			mu.Unlock()
		}

		var body struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(raw, &body); err != nil || body.Name == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}

		mu.Lock()
		id := fmt.Sprintf("%d", nextID)
		nextID++
		item := Item{ID: id, Name: body.Name}
		items[id] = item
		resp, _ := json.Marshal(item)
		if fingerprint != "" {
			idempot[fingerprint] = idemRecord{Status: http.StatusCreated, Body: resp}
		}
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Location", "/items/"+id)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write(resp)
		_, _ = w.Write([]byte("\n"))
	})

	addr := ":8090"
	log.Printf("methods/idempotency server on http://127.0.0.1%s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
