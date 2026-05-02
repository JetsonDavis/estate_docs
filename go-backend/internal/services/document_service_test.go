package services

import (
	"fmt"
	"testing"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// mergeContent (identifier + optional person field lookup) is the Go mirror of
// Python DocumentService._merge_template’s final identifier pass for simple cases.
// Full template parity (macros, IF, counters, <cr>, etc.) is not yet implemented in Go.

func TestDocumentService_mergeContent_SimpleIdentifiers(t *testing.T) {
	s := &DocumentService{DB: nil}
	got := s.mergeContent("<<a>> and <<b>>", map[string]string{"a": "X", "b": "Y"})
	want := "X and Y"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestDocumentService_mergeContent_LeaveUnresolved(t *testing.T) {
	s := &DocumentService{DB: nil}
	const tmpl = "<<missing>>"
	got := s.mergeContent(tmpl, map[string]string{})
	if got != tmpl {
		t.Fatalf("got %q want %q", got, tmpl)
	}
}

func TestDocumentService_mergeContent_PersonNameField(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:personmerge?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Person{}); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	p := models.Person{
		Name:      "Riley",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	s := &DocumentService{DB: db}
	ids := map[string]string{"client": fmt.Sprintf("%d", p.ID)}
	got := s.mergeContent("Name: <<client.name>>", ids)
	want := "Name: Riley"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
