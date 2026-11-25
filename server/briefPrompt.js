/* Shared by the server (server/briefs.js) and the browser (the Morning brief screen). No Node imports here. */
export const DEPARTMENTS = [
  'Environment Protection Department',
  'Primary and Secondary Healthcare Department',
  'Specialized Healthcare and Medical Education Department',
  'School Education Department',
  'Higher Education Department',
  'Agriculture Department',
  'Local Government and Community Development Department',
  'Transport and Mass Transit Department',
  'Irrigation Department',
  'Housing, Urban Development and Public Health Engineering Department',
  'Energy Department',
  'Food Department',
  'Forest, Wildlife and Fisheries Department',
  'Livestock and Dairy Development Department',
  'Industries, Commerce, Investment and Skills Development Department',
  'Social Welfare and Bait-ul-Maal Department',
];
export const SAMPLE_DEPT = DEPARTMENTS[0]; // the recorded (replay) brief is for this department

/* The prompt from the session handout, with the department filled in */
export const briefPrompt = (department, today) => `Today is ${today} (Pakistan time).
Every morning, search news published in the last 24 hours (public sources only)
that mentions the ${department}, Government of Punjab, or its main programmes.
Produce a one-page morning brief for the Secretary:
1. Top 3 stories: one-line summary each, with source name and link.
2. Any claim that appears false or misleading, and what official public
   sources say instead. Mark anything you are unsure of as "verify".
3. A suggested factual one-paragraph response for each, in English and Urdu.
Do not include personal data about private individuals.
End with: "Draft for PRO review. Not for release without approval."`;
