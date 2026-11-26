import http from 'k6/http';
import exec from 'k6/execution';
import { sleep } from 'k6';
import {
  checkDashboard,
  checkHealth,
  checkPlannedFault,
  checkProject,
  checkProjects,
} from '../checks.js';
import { BASE_URL, requestTags } from '../config.js';

export const options = {
  scenarios: {
    smoke: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 12,
      maxDuration: '30s',
    },
  },
  thresholds: {
    // A run that emitted no checks/requests must fail instead of looking green.
    checks_emitted: ['count>0'],
    checks: ['rate==1'],
    http_reqs: ['count>0'],
    'http_req_failed{expected:false}': ['rate==0'],
    'http_req_duration{kind:page}': ['p(95)<400'],
    'http_req_duration{kind:api}': ['p(95)<400'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { project: 'enterprise-qa-portfolio', profile: 'smoke' },
};

export default function () {
  const iteration = exec.scenario.iterationInTest;

  checkHealth(http.get(`${BASE_URL}/api/health`, requestTags('health')));
  checkDashboard(http.get(`${BASE_URL}/`, requestTags('page')));

  if (iteration % 3 === 0) {
    checkProjects(http.get(`${BASE_URL}/api/projects`, requestTags('api')));
  } else {
    const id = (iteration % 6) + 1;
    checkProject(http.get(`${BASE_URL}/api/projects/${id}`, requestTags('api')), id);
  }

  if (iteration % 4 === 0) {
    checkPlannedFault(http.get(`${BASE_URL}/api/fault`, requestTags('fault', 'true')));
  }

  sleep(0.2);
}

export { handleSummary } from '../summary.js';
