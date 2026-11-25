/* Home: every exercise as a card. Click a card to open it. */

export const CASES = [
  { id: 'cm', kind: 'Workflow', short: 'CM summary', title: 'Summary for the CM',
    text: 'A chain of desks turns three documents into one signed summary for the Chief Minister. Each desk is one prompt; officers check between desks.',
    see: 'Fixed steps, run in order' },
  { id: 'cx', kind: 'Automated workflow', short: 'Complaint triage', title: 'Complaint triage',
    text: 'Complaints arrive; AI desks classify each one and draft a reply. Officers approve before anything is sent.',
    see: 'A trigger plus fixed AI desks and a review queue' },
  { id: 'mb', kind: 'Scheduled workflow', slide: 10, short: 'Morning brief', title: 'Morning media brief',
    text: 'Pick a department. Every morning the prompt runs on its own, searches the last 24 hours of news, and leaves a brief in English and Urdu for the PRO.',
    see: 'A time trigger, web search, a human gate' },
  { id: 'ag', kind: 'Agent', slide: 12, short: 'Agent', title: 'Agent: Assembly question',
    text: 'Give a goal, tools and a step limit. The agent chooses its own steps, then stops and escalates to the Secretary.',
    see: 'The AI picks the steps, not you' },
  { id: 'db', kind: 'Dashboard', short: 'Live dashboard', title: 'Live dashboard',
    text: 'Charts that follow exercises 1 and 2 as you run them: smog figures, desk progress and the complaint queue.',
    see: 'Workflow output as live figures' },
  { id: 'aq', kind: 'Prompt to dashboard', short: 'AQI dashboard', title: 'Air quality dashboard',
    text: 'Give an AI a CSV of daily air quality for 10 cities and one prompt; get a dashboard on Lahore. Check its numbers against the reference.',
    see: 'Every number calculated from the file' },
];

export default function Home({ open }) {
  return (
    <section className="band">
      <div className="home-intro">
        <h2>Exercises</h2>
        <p>From a single prompt, to a workflow that runs on a trigger, to an agent that chooses its own steps. In each one, AI drafts and checks; a person approves.</p>
      </div>
      <div className="cases">
        {CASES.map((c, i) => (
          <button key={c.id} className="case" onClick={() => open(c.id)}>
            <span className="case-top">
              <span className="case-n">{i + 1}</span>
              <span className="case-kind">{c.kind}{c.slide && ` · slide ${c.slide}`}</span>
            </span>
            <b>{c.title}</b>
            <span className="case-text">{c.text}</span>
            <span className="case-see">{c.see}</span>
            <span className="case-go">Open →</span>
          </button>
        ))}
      </div>
    </section>
  );
}
