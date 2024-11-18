import { Hono } from "hono";
import { contextStorage, getContext } from "hono/context-storage";
import {
  type AppLoadContext,
  createRequestHandler,
} from "@remix-run/cloudflare";

const app = new Hono();
app.use(contextStorage());
app.use(async (_c, next) => {
  if (!Object.getOwnPropertyDescriptor(process, "env")?.get) {
    const processEnv = process.env;
    Object.defineProperty(process, "env", {
      get() {
        try {
          return { ...processEnv, ...getContext().env };
        } catch {
          return processEnv;
        }
      },
    });
  }
  return next();
});

app.use(async (c) => {
  const build =
    process.env.NODE_ENV !== "development"
      ? import("./build/server")
      : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        // eslint-disable-next-line import/no-unresolved
        import("virtual:remix/server-build");
  const handler = createRequestHandler(await build);
  return handler(c.req.raw, {
    cloudflare: {
      env: c.env,
    },
  } as AppLoadContext);
});

export default app;
