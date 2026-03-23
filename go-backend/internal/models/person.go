package models

import (
	"encoding/json"
	"time"
)

type Person struct {
	ID                           int              `gorm:"primaryKey" json:"id"`
	Name                         string           `gorm:"size:255;index;not null" json:"name"`
	PhoneNumber                  *string          `gorm:"size:20" json:"phone_number"`
	DateOfBirth                  *string          `gorm:"type:date" json:"date_of_birth"`
	SSNEncrypted                 *string          `gorm:"size:255" json:"-"`
	Email                        *string          `gorm:"size:255;index" json:"email"`
	Employer                     *string          `gorm:"size:255" json:"employer"`
	Occupation                   *string          `gorm:"size:255" json:"occupation"`
	MailingAddress               *json.RawMessage `gorm:"type:jsonb" json:"mailing_address"`
	PhysicalAddress              *json.RawMessage `gorm:"type:jsonb" json:"physical_address"`
	TrustorIsLiving              *int             `gorm:"default:1" json:"trustor_is_living"`
	DateOfDeath                  *string          `gorm:"type:date" json:"date_of_death"`
	TrustorDeathCertReceived     *int             `gorm:"column:trustor_death_certificate_received;default:0" json:"trustor_death_certificate_received"`
	TrustorOfSoundMind           *int             `gorm:"default:1" json:"trustor_of_sound_mind"`
	TrustorHasRelinquished       *int             `gorm:"default:0" json:"trustor_has_relinquished"`
	TrustorRelinquishedDate      *string          `gorm:"type:date" json:"trustor_relinquished_date"`
	TrustorRelingDocReceived     *int             `gorm:"column:trustor_reling_doc_received;default:0" json:"trustor_reling_doc_received"`
	IsActive                     int              `gorm:"default:1;not null" json:"is_active"`
	CreatedAt                    time.Time        `gorm:"not null" json:"created_at"`
	UpdatedAt                    time.Time        `gorm:"not null" json:"updated_at"`

	HasSSN bool `gorm:"-" json:"has_ssn"`
}

func (Person) TableName() string { return "people" }

type PersonRelationshipRow struct {
	PersonID         int       `gorm:"primaryKey;column:person_id"`
	RelatedPersonID  int       `gorm:"primaryKey;column:related_person_id"`
	RelationshipType string    `gorm:"size:100;column:relationship_type"`
	CreatedAt        time.Time `gorm:"column:created_at"`
	UpdatedAt        time.Time `gorm:"column:updated_at"`
}

func (PersonRelationshipRow) TableName() string { return "person_relationships" }
