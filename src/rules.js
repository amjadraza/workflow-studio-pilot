/* Offline helpers: keyword classifier (replay mode) and spreadsheet column detection. */
import { isUrdu, norm } from './data.js';

export const RULES = [
  ['smog and burning', /smog|smoke|burn|kiln|stubble|fumes|dhuan|دھواں|آگ|جلا/i, 'Environment Protection Department'],
  ['water', /water|tap|tanker|pipe ?line|supply|پانی/i, 'Water supply (WASA)'],
  ['sanitation', /garbage|waste|sewage|sewer|drain|gutter|litter|trash|کوڑ|گٹر|صفائی/i, 'Waste management / WASA sewerage'],
  ['electricity', /electric|transformer|wire|power|light|load ?shedding|meter|بجلی/i, 'Electricity company (DISCO)'],
  ['health facility', /hospital|doctor|clinic|bhu|medicine|inhaler|pharmacy|nurse|ambulance|ہسپتال|ڈاکٹر|دوائی/i, 'District Health Authority'],
  ['land record', /land|patwari|mutation|girdawari|fard|record|registry|زمین|پٹواری/i, 'Revenue / land record centre'],
  ['staff conduct', /bribe|money|rude|corrupt|clerk|staff|refused|رشوت/i, 'Senior officer / anti-corruption'],
  ['roads', /road|pothole|street|bridge|traffic|سڑک/i, 'Highways / roads branch']
];
export const URGENT = /urgent|days?\b.*(off|no )|no water|electrocut|spark|fire\b|\bill\b|sick|pregnan|child|collapse|danger|accident|overturn|out of stock|cannot see|emergency|فوری|بیمار|خطرہ/i;
export const INJECT = /ignore (all |your |the )?(previous|prior|above)|disregard .*instruction|mark (this|it) as|you are now|system prompt|as an ai/i;
export function rulesClassify(c) {
  const t = c.text || '', hit = RULES.find(([, re]) => re.test(t));
  const injection = INJECT.test(t), cat = hit ? hit[0] : 'other';
  const urgency = injection || cat === 'staff conduct' || !hit || t.length < 25 ? 'needs officer' : URGENT.test(t) ? 'urgent' : 'routine';
  const summary = t.replace(/\s+/g, ' ').split(/(?<=[.!?۔])\s/)[0].split(' ').slice(0, 12).join(' ');
  const reply = isUrdu(t) ? `آپ کی شکایت کا شکریہ۔ اسے متعلقہ دفتر کو بھیج دیا گیا ہے۔ آپ کا حوالہ نمبر ${c.id} ہے۔`
    : `Thank you for your complaint. It has been forwarded to the ${hit ? hit[2] : 'complaint cell'} for action. Your reference is ${c.id}.`;
  return { category: cat, urgency, branch: hit ? hit[2] : 'Complaint cell', summary, injection, reply, by: 'rules' };
}

export const COLS = {
  id: /^(id|ref|ref ?no|reference|complaint ?(id|no|number)|ticket|s\.? ?no\.?|sr\.? ?no\.?|no\.?)$/,
  text: /complaint|text|description|detail|message|issue|grievance|remarks|subject|شکایت/,
  district: /district|city|area|location|tehsil|region|ضلع/,
  channel: /channel|source|mode|medium|via/,
  received: /received|date|time|submitted|created|logged/
};
export function rowsToComplaints(rows) {
  const head = rows[0].map(h => norm(h).replace(/_/g, ' '));
  const find = (k, skip = []) => head.findIndex((h, i) => !skip.includes(i) && COLS[k].test(h));
  const id = find('id'); let text = find('text', [id]);
  if (text < 0) { /* no recognisable header: take the column with the longest text */
    const avg = head.map((_, i) => rows.slice(1).reduce((s, r) => s + String(r[i] || '').length, 0)); text = avg.indexOf(Math.max(...avg));
  }
  const district = find('district', [id, text]), channel = find('channel', [id, text, district]), received = find('received', [id, text, district, channel]);
  const seen = new Set();
  return rows.slice(1).map((r, i) => {
    let cid = id >= 0 ? String(r[id]).trim() : ''; if (!cid || seen.has(cid)) cid = 'U-' + String(i + 1).padStart(3, '0'); seen.add(cid);
    return { id: cid, text: String(r[text] || '').trim(), district: district >= 0 ? String(r[district]).trim() || 'Not given' : 'Not given',
      channel: channel >= 0 ? String(r[channel]).trim() || 'Not given' : 'Upload', received: received >= 0 ? String(r[received]).trim() : '' };
  }).filter(c => c.text);
}
