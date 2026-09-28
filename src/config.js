// Development configuration. The build replaces this file with the runtime
// configuration of the target it packages (see config/targets.json).
// Ads are simulated here, so reward flows can be tried and tested.
export const config = {
  target: 'dev',
  theme: 'kaffeeroesterei',
  ads: { adapter: 'none', simulate: true },
  languageDetection: 'browser',
};
