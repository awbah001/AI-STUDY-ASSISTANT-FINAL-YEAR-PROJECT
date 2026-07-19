/**
 * Type-only re-export of the server router.
 *
 * Using "import type" ensures the bundler NEVER includes any server-side
 * Node.js code (drizzle, better-sqlite3, etc.) in the React Native bundle.
 */
import type { AppRouter } from "../../../server/routers";

export type { AppRouter };
