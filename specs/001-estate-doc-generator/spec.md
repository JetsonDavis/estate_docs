# Feature Specification: Document Merge System

**Feature Branch**: `001-estate-doc-generator`  
**Created**: 2026-01-18  
**Status**: Draft  
**Input**: User description: "We are creating a document merge system. This will consist of two modes. The first is called admin mode and the second is client mode. In admin mode, the user can create create groups of questions which can be multiple choice, free form fields, or drop downs populated by a database table column and will be assigned a unique identifier id. Each question group will eventually be used to input data in client mode and the group have a pointer to the next group. Let's create a subsection that will create question group flows that can be used depending on the answers to the questions. As an example, there may be a question that asks for a client's sex, male or female, in group 1. If the user is a male, the next group will navigate to group 2. If the user is a female, the flow will navigate to group 3. In admin mode, the user will also be able to create document templates and add the unique identifiers from the questions at the desired place or places which will be eventually used in a merge process. The user should be able to upload Word documents, pdfs, or scanned images of documents that will use a large language model to OCR the text, or they can just enter the text directly in an input box. This text can then be edited to add the unique identifiers in the desired spot or spots. Let's store the documents as Markdown text and designate identifiers within the text by using double, greater than, or less than signs. An example would be: Date of Birth: <<dob>>, Place of Birth: <<place_of_birth>>. The second mode will be called client mode. Here the user will be presented with the previously created questions group by group for a client specified at the beginning of the question session and expected to input an answer. The aforementioned pointer will create the flow of questions from one group to the next. The answers will be stored on a per client basis in the database, associated with the unique question identifier. Finally, the user will then be able to merge these answers into any document or documents which will result in a PDF download."

## Clarifications

### Session 2026-01-18

- Q: Which LLM service should be used for OCR of uploaded PDFs and scanned images? → A: AWS Textract
- Q: What authentication mechanism should be used for admin and client mode access? → A: JWT tokens with httpOnly cookies
- Q: How should Word documents and PDFs be converted to Markdown text? → A: Python library: python-docx for Word, PyPDF2/pdfplumber for PDF
- Q: Which Python library should be used to generate PDFs from Markdown templates? → A: ReportLab
- Q: Where should uploaded documents (Word, PDF, images) and generated PDFs be stored? → A: EC2 instance file storage

## User Scenarios & Testing *(mandatory)*

### User Story 0 - User Authentication and Management (Priority: P0)

Users must log in with a username and password to access the system. Administrators can create new user accounts, assign roles (admin or regular user), and manage existing users. Users who forget their password can request a password reset via email. The system maintains secure password storage and session management.

**Why this priority**: Authentication is foundational - without it, the system cannot differentiate between admin and client modes or protect sensitive client data. This must be implemented before any other functionality.

**Independent Test**: Can be fully tested by creating a user account, logging in, logging out, using forgot password flow, and verifying an admin can create/manage users. Delivers security foundation.

**Acceptance Scenarios**:

1. **Given** a user has valid credentials, **When** they enter username and password, **Then** the system authenticates them and creates a session
2. **Given** a user has invalid credentials, **When** they attempt to login, **Then** the system displays an error message and denies access
3. **Given** an administrator is logged in, **When** they access the user management interface, **Then** they can view all users
4. **Given** an administrator creates a new user, **When** they provide username, password, and role, **Then** the system creates the user account
5. **Given** a user forgot their password, **When** they click "Forgot Password" and enter their email, **Then** the system sends a password reset link
6. **Given** a user receives a password reset link, **When** they click it and enter a new password, **Then** the system updates their password
7. **Given** a user is logged in, **When** they log out, **Then** the system terminates their session
8. **Given** an administrator edits a user, **When** they change the user's role or status, **Then** the system updates the user account

---

### User Story 1 - Create Question Group with Flow Logic (Priority: P1)

An administrator creates a question group containing multiple questions (multiple choice, free form text, or database-populated dropdowns). Each question is assigned a unique identifier. The administrator defines conditional flow logic so that based on a client's answer to a question, the system navigates to different next question groups. For example, if a client answers "Male" to a gender question in Group 1, the flow proceeds to Group 2; if "Female", the flow proceeds to Group 3.

**Why this priority**: Conditional question flows are the core differentiator of this system. Without this, the system is just a basic form builder. This enables dynamic, personalized questionnaires.

**Independent Test**: Can be fully tested by creating two question groups, adding a multiple-choice question in Group 1 with conditional logic pointing to different groups based on the answer, and verifying the flow works in client mode. Delivers immediate value as a dynamic questionnaire builder.

**Acceptance Scenarios**:

1. **Given** an administrator is in admin mode, **When** they create a new question group with a unique group ID, **Then** the system saves the question group
2. **Given** an administrator has created a question group, **When** they add a multiple-choice question with a unique identifier, **Then** the question is added to the group
3. **Given** an administrator has created a multiple-choice question, **When** they define conditional flow logic (e.g., "if answer = Male, next group = Group 2"), **Then** the system stores the flow rule
4. **Given** an administrator has created questions, **When** they add a free-form text field with a unique identifier, **Then** the question is added to the group
5. **Given** an administrator needs a dropdown, **When** they create a dropdown question populated from a database table column, **Then** the system retrieves values from the specified table column
6. **Given** a question group has conditional logic, **When** a client answers the question in client mode, **Then** the system navigates to the correct next group based on the answer

---

### User Story 2 - Create Document Template with Identifier Placeholders (Priority: P2)

An administrator creates a document template by either uploading a Word document, PDF, or scanned image (which is OCR'd using an LLM), or by entering text directly. The administrator edits the text to insert unique question identifiers using the `<<identifier>>` syntax. The template is stored as Markdown text with embedded identifiers that will be replaced during the merge process.

**Why this priority**: Document templates are essential for the merge functionality, but they depend on having question identifiers from P1. This is the second critical piece that enables document generation.

**Independent Test**: Can be fully tested by creating a template with text like "Name: <<client_name>>, DOB: <<dob>>", associating it with question identifiers, and verifying it's stored as Markdown. Delivers value by enabling template creation.

**Acceptance Scenarios**:

1. **Given** an administrator is in admin mode, **When** they upload a Word document, **Then** the system converts it to Markdown text
2. **Given** an administrator uploads a PDF or scanned image, **When** the system processes it, **Then** an LLM performs OCR and extracts the text as Markdown
3. **Given** an administrator prefers direct entry, **When** they type text into an input box, **Then** the system accepts the text as Markdown
4. **Given** an administrator has template text, **When** they edit it to insert identifiers using `<<identifier>>` syntax, **Then** the system recognizes these as merge placeholders
5. **Given** an administrator has created a template, **When** they save it, **Then** the system stores it as Markdown with embedded identifiers
6. **Given** a template contains `<<dob>>`, **When** the administrator views available identifiers, **Then** the system shows all question identifiers that can be inserted

---

### User Story 3 - Complete Client Questionnaire with Conditional Flow (Priority: P3)

A user in client mode begins a questionnaire session for a specific client. The system presents question groups one at a time, following the conditional flow logic defined by administrators. The client's answers are stored in the database, associated with both the client and the unique question identifier. The system navigates through groups based on the flow pointers and conditional logic.

**Why this priority**: This is the client-facing functionality that collects the data needed for document merging. It depends on P1 (question groups) being complete.

**Independent Test**: Can be fully tested by starting a client session, answering questions in Group 1, verifying the system navigates to the correct next group based on conditional logic, and confirming answers are stored per client. Delivers value by enabling data collection.

**Acceptance Scenarios**:

1. **Given** a user enters client mode, **When** they start a new questionnaire session, **Then** the system prompts for a client identifier
2. **Given** a client session has started, **When** the system displays the first question group, **Then** all questions in that group are shown
3. **Given** a client answers a multiple-choice question with conditional logic, **When** they submit the answer, **Then** the system navigates to the next group based on the flow rule
4. **Given** a client answers a free-form text question, **When** they submit the answer, **Then** the system stores the answer associated with the question identifier and client
5. **Given** a client answers a dropdown question, **When** they select a value, **Then** the system stores the selected value
6. **Given** a client completes all question groups, **When** the flow reaches the end, **Then** the system indicates the questionnaire is complete
7. **Given** a client has answered questions, **When** they navigate back to a previous group, **Then** their previous answers are displayed

---

### User Story 4 - Merge Client Answers into Document Template (Priority: P4)

A user selects one or more document templates and a client whose questionnaire has been completed. The system merges the client's answers into the template(s) by replacing all `<<identifier>>` placeholders with the corresponding answer values. The merged document is generated as a PDF and made available for download.

**Why this priority**: This is the final output of the system - the merged document. It depends on P2 (templates) and P3 (client answers) being complete. This delivers the end value to users.

**Independent Test**: Can be fully tested by selecting a template with identifiers, selecting a client with completed answers, generating the merge, and downloading a PDF with all placeholders correctly replaced. Delivers complete end-to-end value.

**Acceptance Scenarios**:

1. **Given** a user has completed client questionnaires, **When** they select a client and a document template, **Then** the system initiates the merge process
2. **Given** a template contains `<<dob>>` and the client answered "1990-05-15" for the `dob` question, **When** the merge occurs, **Then** the output shows "Date of Birth: 1990-05-15"
3. **Given** a template has multiple identifier placeholders, **When** the merge occurs, **Then** all placeholders are replaced with the client's corresponding answers
4. **Given** a client has not answered a question referenced in the template, **When** the merge occurs, **Then** the system either leaves the placeholder or inserts a default value (e.g., "[NOT PROVIDED]")
5. **Given** the merge is complete, **When** the user requests the document, **Then** the system generates a PDF for download
6. **Given** a user selects multiple templates, **When** they merge for a single client, **Then** the system generates multiple PDFs, one for each template

---

### User Story 5 - Create Multiple Document Flows (Priority: P2)

An administrator can create multiple document flows, each representing a different questionnaire workflow. Each flow has a starting question group and follows its own conditional logic paths. The administrator uses a UI to design flows, name them, and configure which question groups belong to each flow. When starting a client session, users select which document flow to use.

**Why this priority**: Multiple flows enable the system to support different document types (e.g., trust documents vs. power of attorney) or different client scenarios without mixing question groups. This is essential for a production system but can be deferred after basic flow logic works.

**Independent Test**: Can be fully tested by creating two document flows (e.g., "Trust Flow" and "Will Flow"), assigning different question groups to each, starting client sessions for each flow, and verifying they follow independent paths.

**Acceptance Scenarios**:

1. **Given** an administrator accesses the flow management UI, **When** they create a new document flow, **Then** the system prompts for a flow name and starting question group
2. **Given** an administrator has created a flow, **When** they assign question groups to the flow, **Then** those groups become part of that flow's workflow
3. **Given** multiple flows exist, **When** a user starts a client session, **Then** the system prompts them to select which document flow to use
4. **Given** a client session uses a specific flow, **When** they answer questions, **Then** the system navigates only through question groups in that flow
5. **Given** an administrator edits a flow, **When** they add or remove question groups, **Then** new client sessions reflect the updated flow
6. **Given** an administrator views all flows, **When** they select a flow, **Then** the system displays a visual representation of the flow's question groups and conditional logic

---

### User Story 6 - Manage Question Groups and Templates (Priority: P6)

An administrator can view, edit, and delete existing question groups and document templates. They can modify question text, identifiers, conditional flow logic, and template content. Changes are reflected in future client sessions but do not affect completed questionnaires.

**Why this priority**: Management capabilities are important for long-term system maintenance but are lower priority than core creation and merge functionality. Initial MVP can work with create-only operations.

**Independent Test**: Can be fully tested by editing an existing question group, changing a question's text and identifier, and verifying new client sessions use the updated version while old data remains intact.

**Acceptance Scenarios**:

1. **Given** an administrator views all question groups, **When** they select a group to edit, **Then** the system displays all questions and flow logic for editing
2. **Given** an administrator edits a question's text, **When** they save changes, **Then** new client sessions display the updated text
3. **Given** an administrator changes a question identifier, **When** they save changes, **Then** new templates can use the new identifier
4. **Given** an administrator edits conditional flow logic, **When** they save changes, **Then** new client sessions follow the updated flow
5. **Given** an administrator deletes a question group, **When** they confirm deletion, **Then** the group is removed and no longer available for new client sessions
6. **Given** an administrator edits a template, **When** they modify the Markdown text or identifiers, **Then** future merges use the updated template

---

### Edge Cases

- What happens when a conditional flow rule references a question group that doesn't exist? (Validation prevents saving invalid flow rules)
- What happens when a template references an identifier that no longer exists? (Show warning during merge, leave placeholder or use default)
- What happens when a client partially completes a questionnaire and returns later? (Save progress, allow resumption from last group)
- What happens when an administrator changes a question identifier that's already used in templates? (Show warning, update templates or create new identifier)
- What happens when OCR fails to extract text from an uploaded document? (Display error, allow manual text entry)
- What happens when a dropdown question's database table column is empty? (Display empty dropdown with error message)
- What happens when a client's answer causes an infinite loop in conditional flow? (Detect cycles during flow configuration, prevent saving)
- What happens when multiple administrators edit the same question group simultaneously? (Last write wins, or implement optimistic locking)
- What happens when PDF generation fails during merge? (Display error message, log details, allow retry)
- What happens when a client tries to access another client's questionnaire data? (Authorization check prevents access)
- What happens when an uploaded Word document has complex formatting? (Convert to Markdown with best effort, allow manual editing)
- What happens when a template has malformed identifier syntax (e.g., `<identifier>` instead of `<<identifier>>`)? (Validation during template creation, or ignore during merge)

## Requirements *(mandatory)*

### Functional Requirements

**User Authentication & Management**
- **FR-001**: System MUST require users to log in with username and password
- **FR-002**: System MUST hash and salt passwords before storing in database
- **FR-003**: System MUST create user sessions upon successful authentication
- **FR-004**: System MUST allow administrators to create new user accounts
- **FR-005**: System MUST allow administrators to assign roles to users (admin, regular user)
- **FR-006**: System MUST allow administrators to view, edit, and deactivate user accounts
- **FR-007**: System MUST provide a "Forgot Password" feature that sends reset links via email
- **FR-008**: System MUST validate password reset tokens and allow password updates
- **FR-009**: System MUST enforce password complexity requirements (minimum length, character types)
- **FR-010**: System MUST terminate sessions on logout
- **FR-011**: System MUST automatically expire sessions after period of inactivity

**Admin Mode - Question Group Management**
- **FR-012**: System MUST allow administrators to create question groups with unique group IDs
- **FR-013**: System MUST allow administrators to add questions to groups with unique question identifiers
- **FR-014**: System MUST support multiple-choice questions with predefined options
- **FR-015**: System MUST support free-form text field questions
- **FR-016**: System MUST support dropdown questions populated from database table columns
- **FR-017**: System MUST allow administrators to define conditional flow logic based on question answers
- **FR-018**: System MUST allow administrators to specify the next question group for each possible answer to a question
- **FR-019**: System MUST validate that conditional flow rules reference existing question groups
- **FR-020**: System MUST detect and prevent circular flow logic (infinite loops)

**Admin Mode - Document Flow Management**
- **FR-021**: System MUST allow administrators to create multiple document flows with unique flow IDs
- **FR-022**: System MUST allow administrators to name and describe each document flow
- **FR-023**: System MUST allow administrators to assign a starting question group to each flow
- **FR-024**: System MUST allow administrators to assign question groups to specific flows
- **FR-025**: System MUST provide a UI for visualizing document flow structure and conditional logic
- **FR-026**: System MUST allow administrators to edit and delete document flows
- **FR-027**: System MUST validate that all question groups in a flow have valid navigation paths

**Admin Mode - Document Template Management**
- **FR-028**: System MUST allow administrators to upload Word documents for template creation
- **FR-029**: System MUST allow administrators to upload PDF documents for template creation
- **FR-030**: System MUST allow administrators to upload scanned images for template creation
- **FR-031**: System MUST use AWS Textract to perform OCR on uploaded PDFs and images
- **FR-032**: System MUST convert uploaded Word documents to Markdown text using python-docx library
- **FR-033**: System MUST extract text from PDFs using PyPDF2 or pdfplumber library
- **FR-034**: System MUST allow administrators to enter template text directly in an input box
- **FR-035**: System MUST allow administrators to edit template text to insert question identifiers
- **FR-036**: System MUST recognize identifiers using the `<<identifier>>` syntax
- **FR-037**: System MUST store all templates as Markdown text
- **FR-038**: System MUST validate that identifiers in templates correspond to existing question identifiers
- **FR-039**: System MUST display available question identifiers for administrators to insert into templates

**Client Mode - Questionnaire Completion**
- **FR-040**: System MUST allow users to select a document flow when starting a questionnaire session
- **FR-041**: System MUST allow users to start a questionnaire session for a specific client
- **FR-042**: System MUST prompt for client identification at the start of a session
- **FR-043**: System MUST display question groups one at a time
- **FR-044**: System MUST display all questions within a group simultaneously
- **FR-045**: System MUST navigate to the next question group based on flow pointers and conditional logic
- **FR-046**: System MUST navigate only through question groups assigned to the selected flow
- **FR-047**: System MUST store each answer associated with the client identifier and question identifier
- **FR-048**: System MUST allow clients to navigate back to previous question groups
- **FR-049**: System MUST preserve previously entered answers when navigating backward
- **FR-050**: System MUST validate required questions before allowing navigation to the next group
- **FR-051**: System MUST indicate when a questionnaire session is complete

**Document Merge**
- **FR-052**: System MUST allow users to select a client with completed questionnaire answers
- **FR-053**: System MUST allow users to select one or more document templates for merging
- **FR-054**: System MUST replace all `<<identifier>>` placeholders in templates with corresponding client answers
- **FR-055**: System MUST handle missing answers gracefully (default value or placeholder)
- **FR-056**: System MUST generate merged documents in PDF format using ReportLab library
- **FR-057**: System MUST allow users to download generated PDF documents
- **FR-058**: System MUST support merging multiple templates for a single client in one operation

**Authentication & Authorization**
- **FR-059**: System MUST authenticate users using JWT tokens stored in httpOnly cookies
- **FR-060**: System MUST differentiate between admin and regular user access levels
- **FR-061**: System MUST protect admin endpoints from unauthorized access
- **FR-062**: System MUST implement token refresh mechanism for session management

**File Storage**
- **FR-063**: System MUST store uploaded documents on EC2 instance file system
- **FR-064**: System MUST store generated PDFs on EC2 instance file system
- **FR-065**: System MUST organize files by client ID and document type
- **FR-066**: System MUST implement regular backup strategy for EC2 file storage

**Data Management**
- **FR-067**: System MUST store users, question groups, questions, flows, and flow logic in the database
- **FR-068**: System MUST store document templates as Markdown in the database
- **FR-069**: System MUST store client answers per client, per question identifier
- **FR-070**: System MUST maintain referential integrity between questions, identifiers, templates, and flows
- **FR-071**: System MUST support editing of question groups, templates, and flows
- **FR-072**: System MUST support deletion of question groups, templates, and flows
- **FR-073**: System MUST preserve historical client answer data even if questions are modified or deleted

### Technology Stack

**Authentication**
- JWT tokens with httpOnly cookies for stateless, secure authentication
- Separate access levels for admin mode and client mode
- Token refresh mechanism for session management

**Document Processing**
- AWS Textract for OCR of PDFs and scanned images (>95% accuracy target)
- python-docx for Word document to Markdown conversion
- PyPDF2 or pdfplumber for PDF text extraction
- ReportLab for Markdown to PDF generation

**File Storage**
- EC2 instance file system for uploaded documents and generated PDFs
- Organized by client ID and document type
- Regular backup strategy to S3 or EBS snapshots

### Assumptions

- Administrators have appropriate authentication and authorization for admin mode via JWT
- Client identifiers are unique and provided at the start of each questionnaire session
- Question identifiers are unique across the entire system
- Conditional flow logic is defined per question, not per question group
- A question group can have multiple questions, but only one question per group can have conditional flow logic
- Database table columns used for dropdowns contain text values
- AWS Textract service is available and accessible for document OCR processing
- Word document conversion to Markdown preserves essential text content but may lose complex formatting
- Markdown templates support basic formatting (headings, bold, italic, lists)
- ReportLab supports Markdown-to-PDF conversion with preprocessing via markdown2 or similar
- Generated PDFs are temporary and can be regenerated from stored answers
- System supports a single language initially (can be extended for multi-language)
- File upload size limit for documents is 10MB
- Supported upload formats: .docx, .pdf, .jpg, .png, .tiff
- Clients can have multiple questionnaire sessions over time
- Question groups can be reused across different questionnaire workflows
- EC2 instance has sufficient storage capacity with monitoring and scaling plan

### Key Entities

- **User**: Represents a system user; attributes include user ID, username, password hash, email, role (admin, regular user), is_active flag, created date, last login date
- **Password Reset Token**: Represents a password reset request; attributes include token ID, user ID, token hash, expiration timestamp, used flag
- **Document Flow**: Represents a questionnaire workflow; attributes include flow ID, flow name, description, starting question group ID, creation date
- **Flow Assignment**: Represents question groups assigned to a flow; attributes include assignment ID, flow ID, question group ID
- **Question Group**: Represents a collection of related questions; attributes include group ID, group name, description, creation date
- **Question**: Represents a single question; attributes include question ID, unique identifier, question text, question type (multiple choice, free form, dropdown), question group ID, database table/column (for dropdowns), options (for multiple choice)
- **Flow Rule**: Represents conditional navigation logic; attributes include rule ID, source question ID, answer value, target question group ID
- **Document Template**: Represents a template for document merging; attributes include template ID, template name, Markdown content, creation date, last modified date
- **Client**: Represents a client for whom questionnaires are completed; attributes include client ID, client name, contact information
- **Questionnaire Session**: Represents a client's questionnaire completion session; attributes include session ID, client ID, flow ID, start date, completion date, current question group ID
- **Answer**: Represents a client's answer to a question; attributes include answer ID, session ID, client ID, question identifier, answer value, timestamp
- **Generated Document**: Represents a merged PDF document; attributes include document ID, client ID, template ID, generation date, PDF file location

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can create a question group with 5 questions and conditional flow logic in under 10 minutes
- **SC-002**: Administrators can upload and OCR a 2-page PDF document to create a template in under 3 minutes
- **SC-003**: LLM OCR achieves >95% text extraction accuracy for standard typed documents
- **SC-004**: Clients can complete a 10-question group questionnaire in under 5 minutes
- **SC-005**: Conditional flow navigation occurs instantly (<1 second) after answer submission
- **SC-006**: Document merge process completes and generates PDF in under 10 seconds for templates with up to 50 identifiers
- **SC-007**: 100% of identifiers in templates are correctly replaced with client answers during merge
- **SC-008**: System handles at least 20 concurrent client questionnaire sessions without performance degradation
- **SC-009**: Administrators can edit a question identifier and update all affected templates within 5 minutes
- **SC-010**: 95% of users successfully complete their first questionnaire without requiring support
- **SC-011**: Generated PDFs are downloadable within 2 seconds of merge completion
- **SC-012**: System auto-saves client progress every 30 seconds to prevent data loss
