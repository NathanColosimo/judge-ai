import { serve } from "@hono/node-server";
import app from "./";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    // biome-ignore lint/suspicious/noConsole: Allow console.log for dev
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
