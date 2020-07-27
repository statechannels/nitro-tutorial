import { GanacheServer } from "@statechannels/devtools";

export default async function teardown() {
  await ((global as any).__GANACHE_SERVER__ as GanacheServer).close();
}
