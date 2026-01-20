import apiClient from './api'
import {
  Person,
  PersonCreate,
  PersonUpdate,
  PersonListResponse,
  PersonRelationship,
  PersonRelationshipCreate
} from '../types/person'

export const personService = {
  async getPeople(
    page: number = 1,
    pageSize: number = 20,
    includeInactive: boolean = false,
    search?: string
  ): Promise<PersonListResponse> {
    const response = await apiClient.get<PersonListResponse>('/people', {
      params: {
        page,
        page_size: pageSize,
        include_inactive: includeInactive,
        search
      }
    })
    return response.data
  },

  async getPerson(id: number): Promise<Person> {
    const response = await apiClient.get<Person>(`/people/${id}`)
    return response.data
  },

  async createPerson(data: PersonCreate): Promise<Person> {
    const response = await apiClient.post<Person>('/people', data)
    return response.data
  },

  async updatePerson(id: number, data: PersonUpdate): Promise<Person> {
    const response = await apiClient.put<Person>(`/people/${id}`, data)
    return response.data
  },

  async deletePerson(id: number): Promise<void> {
    await apiClient.delete(`/people/${id}`)
  },

  async addRelationship(
    personId: number,
    data: PersonRelationshipCreate
  ): Promise<void> {
    await apiClient.post(`/people/${personId}/relationships`, data)
  },

  async removeRelationship(
    personId: number,
    relatedPersonId: number
  ): Promise<void> {
    await apiClient.delete(`/people/${personId}/relationships/${relatedPersonId}`)
  },

  async getRelationships(personId: number): Promise<PersonRelationship[]> {
    const response = await apiClient.get<PersonRelationship[]>(
      `/people/${personId}/relationships`
    )
    return response.data
  }
}
