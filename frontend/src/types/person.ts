export interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
}

export interface PersonRelationship {
  person_id: number
  related_person_id: number
  relationship_type: string
  created_at: string
  updated_at: string
}

export interface Person {
  id: number
  name: string
  phone_number: string | null
  date_of_birth: string | null
  email: string | null
  employer: string | null
  occupation: string | null
  mailing_address: Address | null
  physical_address: Address | null
  trustor_is_living: number | null
  date_of_death: string | null
  trustor_death_certificate_received: number | null
  trustor_of_sound_mind: number | null
  trustor_has_relinquished: number | null
  trustor_relinquished_date: string | null
  trustor_reling_doc_received: number | null
  created_at: string
  updated_at: string
  is_active: boolean
  has_ssn: boolean
}

export interface PersonWithRelationships extends Person {
  relationships: PersonRelationship[]
}

export interface PersonCreate {
  name: string
  phone_number?: string
  date_of_birth?: string
  ssn?: string
  email?: string
  employer?: string
  occupation?: string
  mailing_address?: Address
  physical_address?: Address
  trustor_is_living?: number
  date_of_death?: string
  trustor_death_certificate_received?: number
  trustor_of_sound_mind?: number
  trustor_has_relinquished?: number
  trustor_relinquished_date?: string
  trustor_reling_doc_received?: number
}

export interface PersonUpdate {
  name?: string
  phone_number?: string
  date_of_birth?: string
  ssn?: string
  email?: string
  employer?: string
  occupation?: string
  mailing_address?: Address
  physical_address?: Address
  is_active?: boolean
  trustor_is_living?: number
  date_of_death?: string
  trustor_death_certificate_received?: number
  trustor_of_sound_mind?: number
  trustor_has_relinquished?: number
  trustor_relinquished_date?: string
  trustor_reling_doc_received?: number
}

export interface PersonRelationshipCreate {
  related_person_id: number
  relationship_type: string
}

export interface PersonListResponse {
  people: Person[]
  total: number
  page: number
  page_size: number
}
