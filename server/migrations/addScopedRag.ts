import type { Client } from "@libsql/client";
export async function runScopedRagMigration(client: Client) {
  for (const name of ["chatMessages", "generalChatMessages"]) {
    const columns = await client.execute(`PRAGMA table_info(${name})`);
    if (
      columns.rows.length &&
      !columns.rows.some(row => row.name === "retrievalContext")
    ) {
      try {
        await client.execute(
          `ALTER TABLE ${name} ADD COLUMN retrievalContext text`
        );
      } catch (error) {
        const after = await client.execute(`PRAGMA table_info(${name})`);
        if (!after.rows.some(row => row.name === "retrievalContext"))
          throw error;
      }
    }
  }
}
