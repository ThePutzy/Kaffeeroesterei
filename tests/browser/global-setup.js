import { build } from '../../tools/build.mjs';

// Browser tests always run against freshly built packages.
export default async function globalSetup() {
  await build();
}
