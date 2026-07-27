/**
 * System Design demo — CAP trade-offs, caching topologies, and load
 * balancing strategies, runnable independently or as one script.
 *
 * Run: npx tsx system-design/index.ts
 */
import { demoCapTradeoffs } from './cap-scenarios.js';
import { demoCachingTopologies } from './caching-topology.js';
import { demoRoundRobinVsLeastConnections } from './load-balancer.js';

async function main(): Promise<void> {
  demoCapTradeoffs();
  console.log('\n' + '='.repeat(70) + '\n');
  await demoCachingTopologies();
  console.log('\n' + '='.repeat(70) + '\n');
  await demoRoundRobinVsLeastConnections();
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error in demo:', err);
    process.exitCode = 1;
  });
}
