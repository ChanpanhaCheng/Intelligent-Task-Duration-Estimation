const teamFallback = 4;
const assigneeHistory = { 'Alex Chen': 3, 'Maya Patel': 5, 'Jordan Lee': 4 };
const typeBase = { 'Bug Fix': 3, Feature: 5, Improvement: 4 };
const priorityAdjustments = { Low: 0, Medium: 0, High: 1, Critical: 2 };

function stableHash(value) {
  return [...value].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
}

/** Deterministic placeholder for a future model/API. All values are calendar days. */
export function getSampleEstimate({ title, type, description = '', priority = '', assignee = '' }) {
  const base = typeBase[type] ?? teamFallback;
  const history = assigneeHistory[assignee] ?? teamFallback;
  const assigneeAdjustment = Math.round((history - teamFallback) / 2);
  const wordingAdjustment = Math.abs(stableHash(`${title}|${description}|${type}|${assignee}`)) % 3;
  return Math.max(1, base + assigneeAdjustment + (priorityAdjustments[priority] ?? 0) + wordingAdjustment);
}

export function calculateCompletionDate(startDate, estimate) {
  if (!startDate || !estimate) return null;
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + estimate);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function calendarDaysBetween(startDate, completionDate) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [cy, cm, cd] = completionDate.split('-').map(Number);
  return Math.round((Date.UTC(cy, cm - 1, cd) - Date.UTC(sy, sm - 1, sd)) / 86400000);
}
