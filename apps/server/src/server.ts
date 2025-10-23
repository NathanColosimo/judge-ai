import "dotenv/config";
import { createContext } from "@judge-ai/api/context";
import { appRouter } from "@judge-ai/api/routers/index";
import { auth } from "@judge-ai/auth";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// Support both /rpc and /api/rpc so local and Vercel paths both work
app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcPrefixes = ["/rpc", "/api/rpc"] as const;
  for (const prefix of rpcPrefixes) {
    const rpcResult = await rpcHandler.handle(c.req.raw, {
      prefix,
      context,
    });
    if (rpcResult.matched) {
      return c.newResponse(rpcResult.response.body, rpcResult.response);
    }
  }

  const apiPrefixes = ["/api-reference", "/api/api-reference"] as const;
  for (const prefix of apiPrefixes) {
    const apiResult = await apiHandler.handle(c.req.raw, {
      prefix,
      context,
    });
    if (apiResult.matched) {
      return c.newResponse(apiResult.response.body, apiResult.response);
    }
  }

  await next();
});

app.get("/", (c) => c.text("OK"));

export default app;
