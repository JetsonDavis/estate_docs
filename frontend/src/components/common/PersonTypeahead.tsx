import React, { useState, useRef } from 'react'
import { personService } from '../../services/personService'
import { Person } from '../../types/person'

interface PersonTypeaheadProps {
  value: string
  onChange: (value: string, person?: Person) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  required?: boolean
  id?: string
}

const PersonTypeahead: React.FC<PersonTypeaheadProps> = ({
  value,
  onChange,
  placeholder = 'Type to search people...',
  className = 'form-input',
  style,
  required = false,
  id
}) => {
  const [suggestions, setSuggestions] = useState<Person[]>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const datalistId = id || `person-typeahead-${Math.random().toString(36).substr(2, 9)}`

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value
    onChange(searchValue)

    // Debounced search for people
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (searchValue.length >= 2) {
        try {
          const response = await personService.getPeople(1, 50, false, searchValue)
          setSuggestions(response.people)
          
          // Check if exact match was selected
          const exactMatch = response.people.find(p => p.name === searchValue)
          if (exactMatch) {
            onChange(searchValue, exactMatch)
          }
        } catch (err) {
          console.error('Failed to search people:', err)
          setSuggestions([])
        }
      } else {
        setSuggestions([])
      }
    }, 300)
  }

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        list={datalistId}
        className={className}
        style={style}
        placeholder={placeholder}
        required={required}
      />
      <datalist id={datalistId}>
        {suggestions.map((person) => (
          <option key={person.id} value={person.name} />
        ))}
      </datalist>
    </>
  )
}

export default PersonTypeahead
