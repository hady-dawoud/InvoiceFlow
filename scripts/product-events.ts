import { countProductEvents } from "../src/lib/analytics";

const counts = await countProductEvents();
for (const [name, count] of Object.entries(counts)) {
  console.log(`${name} ${count}`);
}
