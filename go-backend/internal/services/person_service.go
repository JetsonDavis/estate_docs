package services

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/estate-docs/go-backend/internal/models"
	"gorm.io/gorm"
)

type PersonService struct {
	DB *gorm.DB
}

func NewPersonService(db *gorm.DB) *PersonService {
	return &PersonService{DB: db}
}

type PersonCreateInput struct {
	Name                     string           `json:"name"`
	PhoneNumber              *string          `json:"phone_number"`
	DateOfBirth              *string          `json:"date_of_birth"`
	SSN                      *string          `json:"ssn"`
	Email                    *string          `json:"email"`
	Employer                 *string          `json:"employer"`
	Occupation               *string          `json:"occupation"`
	MailingAddress           *json.RawMessage `json:"mailing_address"`
	PhysicalAddress          *json.RawMessage `json:"physical_address"`
	TrustorIsLiving          *int             `json:"trustor_is_living"`
	DateOfDeath              *string          `json:"date_of_death"`
	TrustorDeathCertReceived *int             `json:"trustor_death_certificate_received"`
	TrustorOfSoundMind       *int             `json:"trustor_of_sound_mind"`
	TrustorHasRelinquished   *int             `json:"trustor_has_relinquished"`
	TrustorRelinquishedDate  *string          `json:"trustor_relinquished_date"`
	TrustorRelingDocReceived *int             `json:"trustor_reling_doc_received"`
}

type PersonUpdateInput struct {
	Name                     *string          `json:"name"`
	PhoneNumber              *string          `json:"phone_number"`
	DateOfBirth              *string          `json:"date_of_birth"`
	SSN                      *string          `json:"ssn"`
	Email                    *string          `json:"email"`
	Employer                 *string          `json:"employer"`
	Occupation               *string          `json:"occupation"`
	MailingAddress           *json.RawMessage `json:"mailing_address"`
	PhysicalAddress          *json.RawMessage `json:"physical_address"`
	TrustorIsLiving          *int             `json:"trustor_is_living"`
	DateOfDeath              *string          `json:"date_of_death"`
	TrustorDeathCertReceived *int             `json:"trustor_death_certificate_received"`
	TrustorOfSoundMind       *int             `json:"trustor_of_sound_mind"`
	TrustorHasRelinquished   *int             `json:"trustor_has_relinquished"`
	TrustorRelinquishedDate  *string          `json:"trustor_relinquished_date"`
	TrustorRelingDocReceived *int             `json:"trustor_reling_doc_received"`
}

type PersonRelationshipInput struct {
	RelatedPersonID  int    `json:"related_person_id"`
	RelationshipType string `json:"relationship_type"`
}

func (s *PersonService) Create(input PersonCreateInput) (*models.Person, error) {
	p := models.Person{
		Name:                     input.Name,
		PhoneNumber:              input.PhoneNumber,
		DateOfBirth:              input.DateOfBirth,
		Email:                    input.Email,
		Employer:                 input.Employer,
		Occupation:               input.Occupation,
		MailingAddress:           input.MailingAddress,
		PhysicalAddress:          input.PhysicalAddress,
		TrustorIsLiving:          input.TrustorIsLiving,
		DateOfDeath:              input.DateOfDeath,
		TrustorDeathCertReceived: input.TrustorDeathCertReceived,
		TrustorOfSoundMind:       input.TrustorOfSoundMind,
		TrustorHasRelinquished:   input.TrustorHasRelinquished,
		TrustorRelinquishedDate:  input.TrustorRelinquishedDate,
		TrustorRelingDocReceived: input.TrustorRelingDocReceived,
		IsActive:                 1,
		CreatedAt:                time.Now().UTC(),
		UpdatedAt:                time.Now().UTC(),
	}

	// Encrypt SSN if provided
	if input.SSN != nil && *input.SSN != "" {
		// TODO: implement proper encryption
		p.SSNEncrypted = input.SSN
	}

	if err := s.DB.Create(&p).Error; err != nil {
		return nil, err
	}
	p.HasSSN = p.SSNEncrypted != nil && *p.SSNEncrypted != ""
	return &p, nil
}

func (s *PersonService) List(skip, limit int, includeInactive bool, search *string) ([]models.Person, int64, error) {
	var people []models.Person
	var total int64

	q := s.DB.Model(&models.Person{})
	if !includeInactive {
		q = q.Where("is_active = 1")
	}
	if search != nil && *search != "" {
		q = q.Where("name ILIKE ?", "%"+*search+"%")
	}
	q.Count(&total)

	if err := q.Order("name ASC").Offset(skip).Limit(limit).Find(&people).Error; err != nil {
		return nil, 0, err
	}

	for i := range people {
		people[i].HasSSN = people[i].SSNEncrypted != nil && *people[i].SSNEncrypted != ""
	}

	return people, total, nil
}

func (s *PersonService) GetByID(id int) (*models.Person, error) {
	var p models.Person
	if err := s.DB.First(&p, id).Error; err != nil {
		return nil, err
	}
	p.HasSSN = p.SSNEncrypted != nil && *p.SSNEncrypted != ""
	return &p, nil
}

func (s *PersonService) Update(id int, input PersonUpdateInput) (*models.Person, error) {
	var p models.Person
	if err := s.DB.First(&p, id).Error; err != nil {
		return nil, errors.New("person not found")
	}

	if input.Name != nil {
		p.Name = *input.Name
	}
	if input.PhoneNumber != nil {
		p.PhoneNumber = input.PhoneNumber
	}
	if input.DateOfBirth != nil {
		p.DateOfBirth = input.DateOfBirth
	}
	if input.Email != nil {
		p.Email = input.Email
	}
	if input.Employer != nil {
		p.Employer = input.Employer
	}
	if input.Occupation != nil {
		p.Occupation = input.Occupation
	}
	if input.MailingAddress != nil {
		p.MailingAddress = input.MailingAddress
	}
	if input.PhysicalAddress != nil {
		p.PhysicalAddress = input.PhysicalAddress
	}
	if input.TrustorIsLiving != nil {
		p.TrustorIsLiving = input.TrustorIsLiving
	}
	if input.DateOfDeath != nil {
		p.DateOfDeath = input.DateOfDeath
	}
	if input.TrustorDeathCertReceived != nil {
		p.TrustorDeathCertReceived = input.TrustorDeathCertReceived
	}
	if input.TrustorOfSoundMind != nil {
		p.TrustorOfSoundMind = input.TrustorOfSoundMind
	}
	if input.TrustorHasRelinquished != nil {
		p.TrustorHasRelinquished = input.TrustorHasRelinquished
	}
	if input.TrustorRelinquishedDate != nil {
		p.TrustorRelinquishedDate = input.TrustorRelinquishedDate
	}
	if input.TrustorRelingDocReceived != nil {
		p.TrustorRelingDocReceived = input.TrustorRelingDocReceived
	}
	if input.SSN != nil {
		p.SSNEncrypted = input.SSN
	}
	p.UpdatedAt = time.Now().UTC()

	if err := s.DB.Save(&p).Error; err != nil {
		return nil, err
	}
	p.HasSSN = p.SSNEncrypted != nil && *p.SSNEncrypted != ""
	return &p, nil
}

func (s *PersonService) Delete(id int) error {
	var p models.Person
	if err := s.DB.First(&p, id).Error; err != nil {
		return errors.New("person not found")
	}
	p.IsActive = 0
	p.UpdatedAt = time.Now().UTC()
	return s.DB.Save(&p).Error
}

func (s *PersonService) AddRelationship(personID int, input PersonRelationshipInput) error {
	// Verify both people exist
	var p1, p2 models.Person
	if err := s.DB.First(&p1, personID).Error; err != nil {
		return errors.New("person not found")
	}
	if err := s.DB.First(&p2, input.RelatedPersonID).Error; err != nil {
		return errors.New("related person not found")
	}

	rel := models.PersonRelationshipRow{
		PersonID:         personID,
		RelatedPersonID:  input.RelatedPersonID,
		RelationshipType: input.RelationshipType,
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	return s.DB.Create(&rel).Error
}

func (s *PersonService) RemoveRelationship(personID, relatedPersonID int) error {
	result := s.DB.Where("person_id = ? AND related_person_id = ?", personID, relatedPersonID).
		Delete(&models.PersonRelationshipRow{})
	if result.RowsAffected == 0 {
		return errors.New("relationship not found")
	}
	return result.Error
}

type PersonRelationshipResponse struct {
	PersonID         int            `json:"person_id"`
	RelatedPersonID  int            `json:"related_person_id"`
	RelationshipType string         `json:"relationship_type"`
	RelatedPerson    *models.Person `json:"related_person,omitempty"`
}

func (s *PersonService) GetRelationships(personID int) ([]PersonRelationshipResponse, error) {
	var rels []models.PersonRelationshipRow
	s.DB.Where("person_id = ?", personID).Find(&rels)

	var result []PersonRelationshipResponse
	for _, rel := range rels {
		resp := PersonRelationshipResponse{
			PersonID:         rel.PersonID,
			RelatedPersonID:  rel.RelatedPersonID,
			RelationshipType: rel.RelationshipType,
		}
		var related models.Person
		if err := s.DB.First(&related, rel.RelatedPersonID).Error; err == nil {
			related.HasSSN = related.SSNEncrypted != nil && *related.SSNEncrypted != ""
			resp.RelatedPerson = &related
		}
		result = append(result, resp)
	}
	return result, nil
}
