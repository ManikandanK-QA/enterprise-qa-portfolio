import http from 'k6/http';
import exec from 'k6/execution';
import { sleep } from 'k6';
import {
  checkAsset,
  checkDashboard,
  checkHealth,
  checkProjects,
} from '../checks.js';
import { BASE_URL, requestTags } from '../config.js';

export const options = {
  scenarios: {
    steady_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5s', target: 5 },
        { duration: '15s', target: 10 },
        { duration: '10s', target: 10 },
        { duration: '5s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    checks_emitted: ['count>0'],
    checks: ['rate==1'],
    http_reqs: ['count>0'],
    'http_req_failed{expected:false}': [
      { threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' },
    ],
    'http_req_duration{kind:page}': ['p(95)<600'],
    'http_req_duration{kind:asset}': ['p(95)<600'],
    'http_req_duration{kind:api}': ['p(95)<600'],
    'iteration_duration': ['p(95)<3000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { project: 'enterprise-qa-portfolio', profile: 'load' },
};

export default function () {
  const iteration = exec.scenario.iterationInTest;

  if (iteration % 4 === 0) {
    checkHealth(http.get(`${BASE_URL}/api/health`, requestTags('health')));
  }

  const responses = http.batch([
    ['GET', `${BASE_URL}/`, null, requestTags('page')],
    ['GET', `${BASE_URL}/assets/app.css`, null, requestTags('asset')],
    ['GET', `${BASE_URL}/assets/app.js`, null, requestTags('asset')],
  ]);
  checkDashboard(responses[0]);
  checkAsset(responses[1], 'app.css');
  checkAsset(responses[2], 'app.js');

  checkProjects(http.get(`${BASE_URL}/api/projects`, requestTags('api')));
  sleep(0.5);
}

export { handleSummary } from '../summary.js';
