/**
 * API helpers for creating and tearing down e2e test data.
 * Uses Node.js fetch to call the backend directly (no browser needed).
 */

const API_BASE = 'http://localhost:8005/api/v1';

let authCookie = '';

export async function apiLogin(): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password' }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  authCookie = setCookies.map(c => c.split(';')[0]).join('; ');
}

async function apiRequest(method: string, path: string, body?: any): Promise<any> {
  if (!authCookie) await apiLogin();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'follow',
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Question Group + Questions ──────────────────────────────────────────

export interface TestQuestionGroup {
  groupId: number;
  trustorId: number;
  ableToActId: number;
  unableReasonId: number;
  unableDateId: number;
}

export async function createTestQuestionGroup(nameSuffix: string): Promise<TestQuestionGroup> {
  const groupName = `E2E_Repeatable_${nameSuffix}`;
  const groupIdentifier = `e2e_repeatable_${nameSuffix.toLowerCase().replace(/\s+/g, '_')}`;

  const group = await apiRequest('POST', '/question-groups', {
    name: groupName,
    identifier: groupIdentifier,
    description: 'Auto-created by e2e test',
    display_order: 999,
  });

  const groupId = group.id;
  const rgUuid = crypto.randomUUID();

  // Person question – repeatable parent
  const trustor = await apiRequest('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: 'Who are trustors?',
    question_type: 'person',
    identifier: 'trustor',
    repeatable: true,
    repeatable_group_id: rgUuid,
    display_order: 0,
  });

  // Multiple-choice – repeatable child in same group
  const ableToAct = await apiRequest('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: 'are they able to act?',
    question_type: 'multiple_choice',
    identifier: 'able_to_act',
    repeatable: true,
    repeatable_group_id: rgUuid,
    display_order: 1,
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ],
  });

  // Conditional followup – free text (shown when able_to_act = "no")
  const unableReason = await apiRequest('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: "Why can't the trustor act?",
    question_type: 'free_text',
    identifier: 'unable_reason',
    repeatable: false,
    display_order: 2,
    is_required: false,
  });

  // Conditional followup – date (shown when able_to_act = "no")
  const unableDate = await apiRequest('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: 'when did they become unable to act?',
    question_type: 'date',
    identifier: 'unable_date',
    repeatable: false,
    display_order: 3,
    is_required: false,
  });

  // Build question_logic with conditional wiring
  const questionLogic = [
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: trustor.id,
      depth: 0,
      localQuestionId: rgUuid,
    },
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: ableToAct.id,
      depth: 0,
      localQuestionId: crypto.randomUUID(),
    },
    {
      id: crypto.randomUUID(),
      type: 'conditional',
      conditional: {
        ifIdentifier: 'able_to_act',
        value: 'no',
        operator: 'equals',
        nestedItems: [
          {
            id: crypto.randomUUID(),
            type: 'question',
            questionId: unableReason.id,
            depth: 1,
            localQuestionId: crypto.randomUUID(),
          },
          {
            id: crypto.randomUUID(),
            type: 'question',
            questionId: unableDate.id,
            depth: 1,
            localQuestionId: crypto.randomUUID(),
          },
        ],
      },
      depth: 0,
    },
  ];

  await apiRequest('PUT', `/question-groups/${groupId}`, {
    question_logic: questionLogic,
  });

  return {
    groupId,
    trustorId: trustor.id,
    ableToActId: ableToAct.id,
    unableReasonId: unableReason.id,
    unableDateId: unableDate.id,
  };
}

// ── Session ─────────────────────────────────────────────────────────────

export async function createTestSession(
  groupId: number,
  clientName: string,
): Promise<number> {
  const session = await apiRequest('POST', '/sessions/', {
    client_identifier: clientName,
    starting_group_id: groupId,
  });
  return session.id;
}

export async function saveAnswers(
  sessionId: number,
  answers: { question_id: number; answer_value: string }[],
): Promise<void> {
  await apiRequest('POST', `/sessions/${sessionId}/save-answers`, { answers });
}

// ── Template ────────────────────────────────────────────────────────────

export async function createTestTemplate(
  name: string,
  markdownContent: string,
): Promise<number> {
  const template = await apiRequest('POST', '/templates/', {
    name,
    template_type: 'direct',
    markdown_content: markdownContent,
  });
  return template.id;
}

// ── Cleanup ─────────────────────────────────────────────────────────────

export async function deleteSession(id: number): Promise<void> {
  try { await apiRequest('DELETE', `/sessions/${id}`); } catch { /* ignore */ }
}

export async function deleteQuestionGroup(id: number): Promise<void> {
  try { await apiRequest('DELETE', `/question-groups/${id}`); } catch { /* ignore */ }
}

export async function deleteTemplate(id: number): Promise<void> {
  try { await apiRequest('DELETE', `/templates/${id}`); } catch { /* ignore */ }
}
