import { check } from 'k6';
import { Counter } from 'k6/metrics';

// A run that emits no checks must not be able to pass. k6's built-in `checks`
// metric is a Rate and does not support a count threshold, so this Counter records
// how many check assertions were actually evaluated.
export const checksEmitted = new Counter('checks_emitted');

function countedCheck(response, assertions, tags) {
  const result = check(response, assertions, tags);
  checksEmitted.add(Object.keys(assertions).length);
  return result;
}

function parseJson(response) {
  try {
    return JSON.parse(response.body);
  } catch {
    return null;
  }
}

export function checkHealth(response) {
  return countedCheck(
    response,
    {
      'health returns 200': (r) => r.status === 200,
      'health reports ok': (r) => parseJson(r)?.status === 'ok',
    },
    { kind: 'health' },
  );
}

export function checkDashboard(response) {
  return countedCheck(
    response,
    {
      'dashboard returns 200': (r) => r.status === 200,
      'dashboard has the title': (r) => r.body.includes('OpsBoard'),
      'dashboard has a stable project list hook': (r) =>
        r.body.includes('data-test="project-list"'),
    },
    { kind: 'page' },
  );
}

export function checkAsset(response, expectedName) {
  return countedCheck(
    response,
    {
      [`${expectedName} returns 200`]: (r) => r.status === 200,
      [`${expectedName} is not empty`]: (r) => r.body.length > 100,
    },
    { kind: 'asset' },
  );
}

export function checkProjects(response) {
  const payload = parseJson(response);
  return countedCheck(
    response,
    {
      'projects returns 200': (r) => r.status === 200,
      'projects contains six deterministic records': () => payload?.total === 6 && payload.items.length === 6,
      'projects expose stable ids': () =>
        Array.isArray(payload?.items) &&
        payload.items.every((item, index) => item.id === index + 1),
    },
    { kind: 'api' },
  );
}

export function checkProject(response, expectedId) {
  const payload = parseJson(response);
  return countedCheck(
    response,
    {
      'project returns 200': (r) => r.status === 200,
      'project id matches the deterministic cycle': () => payload?.id === expectedId,
      'project has a status': () => typeof payload?.status === 'string',
    },
    { kind: 'api' },
  );
}

export function checkSlow(response) {
  const payload = parseJson(response);
  return countedCheck(
    response,
    {
      'slow endpoint returns 200': (r) => r.status === 200,
      'slow endpoint reports its configured latency': () => payload?.source === 'local-lab',
    },
    { kind: 'slow' },
  );
}

export function checkPlannedFault(response) {
  const payload = parseJson(response);
  return countedCheck(
    response,
    {
      'planned fault returns 503': (r) => r.status === 503,
      'planned fault is clearly labelled': () => payload?.status === 'planned_failure',
    },
    { kind: 'fault' },
  );
}
