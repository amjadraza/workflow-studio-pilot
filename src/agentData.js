/* Agent tab (fictional training data): the Assembly question, a past-reply archive,
   simulated wing replies, and the tools the agent may use. */

export const AG_QUESTION = `Provincial Assembly, Starred Question (fictional, for training)
Will the Minister for Environment be pleased to state:
(a) the measures taken to control smog in Lahore Division during the week ending 16 November;
(b) the number of industrial units sealed during that week; and
(c) the number of citizen complaints about smoke and burning received on 17 November?`;

export const AG_ARCHIVE = [
  { id: 'PAQ-118 (2025)', subject: 'Smog control measures in Lahore', text: 'Reply: (a) Anti-smog squads were notified in all districts of Lahore Division and inspections of industrial units and brick kilns were intensified. (b) 27 units were sealed during the week. Figures were provided by the Monitoring Cell, Environment Protection Department.' },
  { id: 'PAQ-131 (2025)', subject: 'Conversion of brick kilns to zig-zag technology', text: 'Reply: All brick kilns in Lahore Division are to be converted to zig-zag technology by June 2026. Non-converted kilns are sealed during the smog season.' },
  { id: 'PAQ-044 (2026)', subject: 'Water supply in Lahore', text: 'Reply: Water supply schemes in three union councils are being rehabilitated by WASA.' },
];

export const AG_WINGS = [
  { match: /environment|epd|monitoring/i, reply: 'Reply from the Monitoring Cell, Environment Protection Department (simulated): Confirmed. 38 units were sealed in Week 46 (10 to 16 November). The press release figure of 45 wrongly included 7 units sealed in Week 45. A correction has been sent to the Public Relations Wing.' },
  { match: /finance/i, reply: 'Reply from the Finance Department (simulated): The costing of Option B is not yet finalised. No figure can be quoted.' },
  { match: /school|education/i, reply: 'Reply from the School Education Department (simulated): Schools can move online on 20 and 21 November if informed by Tuesday evening.' },
  { match: /public relations|pr wing|press/i, reply: 'Reply from the Public Relations Wing (simulated): The press release figures were provided by the Environment Protection Department.' },
];

/* Tool definitions in the Claude API format (name, description, input_schema) */
export const AG_TOOLS = [
  { name: 'search_past_replies', description: 'Search the archive of past Assembly replies by keywords.', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'keywords' } }, required: ['query'] } },
  { name: 'read_document', description: 'Read one of the department documents: doc1 (smog situation report, Week 46), doc2 (proposed measures note), doc3 (press release).', input_schema: { type: 'object', properties: { doc_id: { type: 'string', enum: ['doc1', 'doc2', 'doc3'] } }, required: ['doc_id'] } },
  { name: 'query_complaints', description: 'Count complaints in the complaint system (received 17 November), optionally filtered by category (water, roads, sanitation, health facility, land record, staff conduct, smog and burning, electricity, other) and district.', input_schema: { type: 'object', properties: { category: { type: 'string' }, district: { type: 'string' } } } },
  { name: 'request_information', description: 'Ask a wing or department to confirm a fact. Returns their reply.', input_schema: { type: 'object', properties: { wing: { type: 'string' }, question: { type: 'string' } }, required: ['wing', 'question'] } },
  { name: 'draft_reply', description: 'Save the current draft of the Assembly reply. Call again to replace it.', input_schema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'] } },
  { name: 'check_reply', description: 'Check every number in the saved draft against the sources the agent has read or been told. Returns any number that has no source.', input_schema: { type: 'object', properties: {} } },
  { name: 'escalate_to_secretary', description: 'Stop and hand the draft to the Secretary with the reason. Always the last step.', input_schema: { type: 'object', properties: { reason: { type: 'string' }, summary: { type: 'string' } }, required: ['reason'] } },
];
export const ALWAYS_ON = 'escalate_to_secretary';

export const BLOCKED_TOOLS = [
  ['submit_to_assembly', 'only the Secretary submits'],
  ['approve_reply', 'only a person approves'],
  ['delete_records', 'never'],
];
export const ESCALATE_WHEN = [
  'a figure cannot be confirmed',
  'personal data appears',
  'the reply would commit funds or new policy',
  'the draft is ready (always ends with the Secretary)',
];

/* The recorded (replay) draft; it changes with what the agent could confirm */
export const recordedDraft = (confirmed, complaints) => `(a) During the week ending 16 November, anti-smog squads in Lahore Division inspected 146 industrial units and issued 61 notices; 1,240 vehicles were checked on entry routes into Lahore and 212 were fined. Satellite fire detections from crop-residue burning fell to 412 from 598 in the previous week. Additional measures for 18 to 23 November, including online classes and night checks, are under the Government's consideration.
(b) ${confirmed ? '38 industrial units were sealed during the week. The figure of 45 in the press release of 17 November included 7 units sealed in the previous week and has been corrected.' : 'Sources differ: the situation report records 38 units sealed and the press release of 17 November records 45. The figure is being confirmed with the Environment Protection Department.'}
(c) ${complaints != null ? `On 17 November, ${complaints} complaints about smoke and burning were received through the complaint system and forwarded to the field teams.` : 'Information on complaints is being collected and will be provided.'}`;

export function agentBrief({ goal, max, feedback, draft }) {
  return `You are an assistant agent in the Environment Protection Department, Government of Punjab. This is a training simulation.
GOAL: prepare a draft reply to the Provincial Assembly question below, ready for the Secretary's signature.

HOW TO WORK
- Decide your own steps, using only the tools you have. Plan briefly first.
- Use only facts that tools return. Never invent a figure.
- If sources disagree, try to confirm with the responsible wing. If you cannot confirm, report both figures and say the figure is being confirmed.
- Reply in the standard form: (a), (b), (c); formal English; under 180 words.
- Before finishing, save the draft with draft_reply and run check_reply.
- Finish by calling escalate_to_secretary with the reason. You cannot submit, approve or delete anything.

STOP AND ESCALATE EARLY IF: a figure cannot be confirmed; personal data appears; the reply would commit funds or new policy.
LIMIT: at most ${max} tool calls in total.

QUESTION:
${goal}${feedback ? `\n\nTHE SECRETARY SENT YOUR LAST DRAFT BACK WITH THIS NOTE. Revise accordingly:\n${feedback}\n\nYOUR LAST DRAFT:\n${draft}` : ''}`;
}
