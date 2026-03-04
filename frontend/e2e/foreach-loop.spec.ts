import { test, expect, APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:8005';
const API = '/api/v1';

test.describe('FOREACH loop template merge', () => {
  let req: APIRequestContext;
  let groupId: number;
  let questionIds: number[] = [];
  let templateId: number;
  let sessionId: number;
  const uid = Date.now().toString();

  test.beforeAll(async ({ playwright }) => {
    req = await playwright.request.newContext({ baseURL: BASE });
    const loginRes = await req.post(`${API}/auth/login`, {
      data: { username: 'admin', password: 'password' },
    });
    expect(loginRes.ok()).toBe(true);
  });

  test.afterAll(async () => {
    try { if (templateId) await req.delete(`${API}/templates/${templateId}`); } catch {}
    try { if (sessionId) await req.delete(`${API}/sessions/${sessionId}`); } catch {}
    try { if (groupId) await req.delete(`${API}/question-groups/${groupId}`); } catch {}
    await req.dispose();
  });

  test('FOREACH should expand repeatable answers into repeated blocks', async () => {
    // 1. Create a question group with repeatable text questions
    const groupRes = await req.post(`${API}/question-groups`, {
      data: { name: `ForeachTest_${uid}`, identifier: `foreachtest_${uid}`, description: 'Test group for FOREACH' },
    });
    expect(groupRes.ok()).toBe(true);
    const group = await groupRes.json();
    groupId = group.id;
    console.log('Created group:', groupId, 'identifier:', group.identifier);

    // 2. Create two repeatable questions in the group
    const q1Res = await req.post(`${API}/question-groups/${groupId}/questions`, {
      data: {
        question_group_id: groupId,
        question_text: 'Beneficiary Name',
        question_type: 'free_text',
        identifier: 'beneficiary_name',
        repeatable: true,
        repeatable_group_id: `rg_${uid}`,
        display_order: 1,
        is_required: false,
      },
    });
    expect(q1Res.ok()).toBe(true);
    const q1 = await q1Res.json();
    questionIds.push(q1.id);
    console.log('Created q1:', q1.id, 'full identifier:', q1.identifier);

    const q2Res = await req.post(`${API}/question-groups/${groupId}/questions`, {
      data: {
        question_group_id: groupId,
        question_text: 'Beneficiary Share',
        question_type: 'free_text',
        identifier: 'beneficiary_share',
        repeatable: true,
        repeatable_group_id: `rg_${uid}`,
        display_order: 2,
        is_required: false,
      },
    });
    expect(q2Res.ok()).toBe(true);
    const q2 = await q2Res.json();
    questionIds.push(q2.id);
    console.log('Created q2:', q2.id, 'full identifier:', q2.identifier);

    // 3. Create a template that uses FOREACH with the identifiers
    // NOTE: The question identifiers are namespaced as "group_identifier.question_identifier"
    // Templates can use either the full namespaced or stripped identifier.
    // Let's test with the stripped identifier first (as shown in docs)
    const templateMarkdown = [
      'LAST WILL AND TESTAMENT',
      '',
      '{{ FOREACH beneficiary_name }}',
      '##. <<beneficiary_name>> shall receive <<beneficiary_share>> of the estate.',
      '{{ END FOREACH }}',
      '',
      'End of document.',
    ].join('\n');

    console.log('Template markdown:\n' + templateMarkdown);

    const tmplRes = await req.post(`${API}/templates`, {
      data: {
        name: `ForeachTemplate_${uid}`,
        description: 'Test template with FOREACH',
        template_type: 'direct',
        markdown_content: templateMarkdown,
      },
    });
    expect(tmplRes.ok()).toBe(true);
    const tmpl = await tmplRes.json();
    templateId = tmpl.id;
    console.log('Created template:', templateId);

    // 4. Create a session
    const sessRes = await req.post(`${API}/sessions`, {
      data: {
        client_identifier: `ForeachClient_${uid}`,
        starting_group_id: groupId,
      },
    });
    expect(sessRes.ok()).toBe(true);
    const sess = await sessRes.json();
    sessionId = sess.id;
    console.log('Created session:', sessionId);

    // 5. Save repeatable answers as JSON arrays
    const namesArray = JSON.stringify(['Alice', 'Bob', 'Charlie']);
    const sharesArray = JSON.stringify(['50%', '30%', '20%']);

    const saveRes = await req.post(`${API}/sessions/${sessionId}/save-answers`, {
      data: {
        answers: [
          { question_id: q1.id, answer_value: namesArray },
          { question_id: q2.id, answer_value: sharesArray },
        ],
      },
    });
    expect(saveRes.ok()).toBe(true);
    console.log('Saved answers:', namesArray, sharesArray);

    // 6. Verify answers were saved
    const detailRes = await req.get(`${API}/sessions/${sessionId}`);
    const sessionDetail = await detailRes.json();
    console.log('Session answers:', JSON.stringify(sessionDetail.answers));

    // 7. Preview the document to check FOREACH expansion
    const previewRes = await req.post(
      `${API}/documents/preview?session_id=${sessionId}&template_id=${templateId}`,
    );
    expect(previewRes.ok()).toBe(true);
    const preview = await previewRes.json();
    console.log('=== PREVIEW RESULT ===');
    console.log('markdown_content:', preview.markdown_content);
    console.log('missing_identifiers:', JSON.stringify(preview.missing_identifiers));
    console.log('available_identifiers:', JSON.stringify(preview.available_identifiers));
    console.log('=== END PREVIEW ===');

    // 8. Verify FOREACH expanded correctly
    const content: string = preview.markdown_content;
    expect(content).toContain('Alice');
    expect(content).toContain('Bob');
    expect(content).toContain('Charlie');
    expect(content).toContain('50%');
    expect(content).toContain('30%');
    expect(content).toContain('20%');

    // Should NOT contain the FOREACH markers anymore
    expect(content).not.toContain('FOREACH');
    expect(content).not.toContain('END FOREACH');

    console.log('FOREACH loop test PASSED!');
  });

  test('FOREACH should expand person-type repeatable answers via preview', async () => {
    const uid2 = Date.now().toString();
    let gId: number, tId: number, sId: number;

    // 1. Create group
    const gRes = await req.post(`${API}/question-groups`, {
      data: { name: `ForeachPerson_${uid2}`, identifier: `foreachperson_${uid2}`, description: 'Person FOREACH test' },
    });
    expect(gRes.ok()).toBe(true);
    const g = await gRes.json();
    gId = g.id;

    // 2. Create person-type repeatable question + free_text repeatable question
    const pRes = await req.post(`${API}/question-groups/${gId}/questions`, {
      data: {
        question_group_id: gId,
        question_text: 'Beneficiary',
        question_type: 'person',
        identifier: 'bene_person',
        repeatable: true,
        repeatable_group_id: `rpg_${uid2}`,
        display_order: 1,
        is_required: false,
      },
    });
    expect(pRes.ok()).toBe(true);
    const pQ = await pRes.json();

    const sRes2 = await req.post(`${API}/question-groups/${gId}/questions`, {
      data: {
        question_group_id: gId,
        question_text: 'Share percentage',
        question_type: 'free_text',
        identifier: 'bene_share',
        repeatable: true,
        repeatable_group_id: `rpg_${uid2}`,
        display_order: 2,
        is_required: false,
      },
    });
    expect(sRes2.ok()).toBe(true);
    const sQ = await sRes2.json();

    // 3. Template using FOREACH with person dot notation
    const tmpl = [
      '{{ FOREACH bene_person }}',
      '##. <<bene_person.name>> shall receive <<bene_share>>.',
      '{{ END FOREACH }}',
    ].join('\n');

    const tRes = await req.post(`${API}/templates`, {
      data: {
        name: `ForeachPersonTmpl_${uid2}`,
        template_type: 'direct',
        markdown_content: tmpl,
      },
    });
    expect(tRes.ok()).toBe(true);
    tId = (await tRes.json()).id;

    // 4. Session
    const sessRes = await req.post(`${API}/sessions`, {
      data: { client_identifier: `ForeachPersonClient_${uid2}`, starting_group_id: gId },
    });
    expect(sessRes.ok()).toBe(true);
    sId = (await sessRes.json()).id;

    // 5. Save person-type answers (JSON array of person JSON strings)
    const personArray = JSON.stringify([
      '{"name":"Alice Smith"}',
      '{"name":"Bob Jones"}',
    ]);
    const shareArray = JSON.stringify(['60%', '40%']);

    await req.post(`${API}/sessions/${sId}/save-answers`, {
      data: {
        answers: [
          { question_id: pQ.id, answer_value: personArray },
          { question_id: sQ.id, answer_value: shareArray },
        ],
      },
    });

    // 6. Preview (this was the buggy path - no raw_answer_map)
    const prevRes = await req.post(
      `${API}/documents/preview?session_id=${sId}&template_id=${tId}`,
    );
    expect(prevRes.ok()).toBe(true);
    const prev = await prevRes.json();
    console.log('Person FOREACH preview:', prev.markdown_content);

    const c: string = prev.markdown_content;
    expect(c).toContain('Alice Smith');
    expect(c).toContain('Bob Jones');
    expect(c).toContain('60%');
    expect(c).toContain('40%');
    expect(c).not.toContain('FOREACH');

    // 7. Also test generate_document (should also work)
    const genRes = await req.post(`${API}/documents/generate`, {
      data: { session_id: sId, template_id: tId, document_name: `PersonForeach_${uid2}` },
    });
    expect(genRes.ok()).toBe(true);
    const gen = await genRes.json();
    console.log('Person FOREACH generated:', gen.markdown_content);
    expect(gen.markdown_content).toContain('Alice Smith');
    expect(gen.markdown_content).toContain('Bob Jones');

    console.log('Person-type FOREACH test PASSED!');

    // Cleanup
    try { await req.delete(`${API}/templates/${tId}`); } catch {}
    try { await req.delete(`${API}/sessions/${sId}`); } catch {}
    try { await req.delete(`${API}/question-groups/${gId}`); } catch {}
  });
});
