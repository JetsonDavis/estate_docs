import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import QuestionGroups from '../QuestionGroups'
import { questionGroupService } from '../../../services/questionService'

// Mock the question group service
jest.mock('../../../services/questionService', () => ({
  questionGroupService: {
    listQuestionGroups: jest.fn(),
    getQuestionGroup: jest.fn(),
    createQuestionGroup: jest.fn(),
    updateQuestionGroup: jest.fn(),
    deleteQuestionGroup: jest.fn(),
    copyQuestionGroup: jest.fn(),
  },
}))

// Mock the toast hook
jest.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}))

const mockQuestionGroups = {
  question_groups: [
    {
      id: 1,
      name: 'Test Group 1',
      description: 'Test description',
      is_active: true,
      question_count: 5,
      questions: [],
    },
  ],
  total: 1,
}

describe('QuestionGroups Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing and displays the create button', async () => {
    // This test will catch styled-components errors during render
    (questionGroupService.listQuestionGroups as jest.Mock).mockResolvedValue(mockQuestionGroups)

    render(
      <BrowserRouter>
        <QuestionGroups />
      </BrowserRouter>
    )

    // Wait for the component to finish loading
    await waitFor(() => {
      expect(screen.getByText('Create Questions Group')).toBeInTheDocument()
    })
  })

  it('renders question groups list when data is loaded', async () => {
    (questionGroupService.listQuestionGroups as jest.Mock).mockResolvedValue(mockQuestionGroups)

    render(
      <BrowserRouter>
        <QuestionGroups />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Test Group 1')).toBeInTheDocument()
    })
  })

  it('displays empty state when no question groups exist', async () => {
    (questionGroupService.listQuestionGroups as jest.Mock).mockResolvedValue({
      question_groups: [],
      total: 0,
    })

    render(
      <BrowserRouter>
        <QuestionGroups />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No question groups')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Failed to load question groups'
    ;(questionGroupService.listQuestionGroups as jest.Mock).mockRejectedValue(
      new Error(errorMessage)
    )

    render(
      <BrowserRouter>
        <QuestionGroups />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Failed to load question groups/i)).toBeInTheDocument()
    })
  })

  it('renders styled components with transient props correctly', async () => {
    // This specifically tests that styled-components with $flash prop work
    // If there's a type mismatch, this will throw an error during render
    (questionGroupService.listQuestionGroups as jest.Mock).mockResolvedValue(mockQuestionGroups)

    const { container } = render(
      <BrowserRouter>
        <QuestionGroups />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Create Questions Group')).toBeInTheDocument()
    })

    // Verify the component rendered without styled-components errors
    expect(container.firstChild).toBeTruthy()
  })
})
