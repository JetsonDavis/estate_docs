/**
 * Smoke test for QuestionGroups component
 * 
 * This test ensures that the QuestionGroups component can be imported
 * and type-checked without errors. It will catch:
 * - styled-components version conflicts
 * - TypeScript type errors
 * - Import/export issues
 * 
 * Run with: npm run type-check
 */

import type { FC } from 'react'

// This import will fail at type-check time if there are styled-components issues
import QuestionGroups from '../QuestionGroups'

// Type assertion to ensure the component is properly typed
const _typeCheck: FC = QuestionGroups

// Export to prevent unused variable warning
export { _typeCheck }
