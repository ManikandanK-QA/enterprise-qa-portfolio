import http from 'k6/http';
import { sleep } from 'k6';
import { checkDashboard, checkHealth, checkProjects, checkSlow } from '../checks.js';
import { BASE_URL, requestTags } from '../config.js';

export const options = {
  scenarios: {
    bounded_peak: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '5s', target: 12 },
        { duration: '10s', target: 24 },
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
      { threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '8s' },
    ],
    'http_req_duration{kind:page}': ['p(95)<900', 'p(99)<1500'],
    'http_req_duration{kind:api}': ['p(95)<900'],
    'http_req_duration{kind:slow}': ['p(95)<1000'],
    'iteration_duration': ['p(95)<3500'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  tags: { project: 'enterprise-qa-portfolio', profile: 'stress' },
};

export default function () {
  checkHealth(http.get(`${BASE_URL}/api/health`, requestTags('health')));
  checkDashboard(http.get(`${BASE_URL}/`, requestTags('page')));
  checkProjects(http.get(`${BASE_URL}/api/projects`, requestTags('api')));
  checkSlow(http.get(`${BASE_URL}/api/slow`, requestTags('slow')));
  sleep(0.3);
}

export { handleSummary } from '../summary.js';
