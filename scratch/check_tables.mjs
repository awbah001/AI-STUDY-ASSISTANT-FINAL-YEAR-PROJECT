import { createClient } from "@libsql/client";
const c = createClient({ url: "file:./data/app.db" });
const r = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log(r.rows.map((x) => x.name).join("\n"));
