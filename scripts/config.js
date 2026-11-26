export const BASE_URL = (__ENV.BASE_URL ?? 'http://127.0.0.1:8085').replace(/\/$/, '');
export const PROFILE = __ENV.PROFILE ?? 'unknown';

export const PROFILE_TAGS = {
  project: 'enterprise-qa-portfolio',
  profile: PROFILE,
};

export function requestTags(kind, expected = 'false') {
  return {
    tags: {
      ...PROFILE_TAGS,
      kind,
      expected,
    },
  };
}
