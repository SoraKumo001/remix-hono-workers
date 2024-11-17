import { Hono } from "hono";
import { contextStorage, getContext } from "hono/context-storage";
import {
  type AppLoadContext,
  createRequestHandler,
} from "@remix-run/cloudflare";

const app = new Hono();
app.use(contextStorage());

app.use(async (c) => {
  setProcessEnv(c.env as Env);
  const build =
    process.env.NODE_ENV !== "development"
      ? await import("./build/server")
      : // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        // eslint-disable-next-line import/no-unresolved
        await import("virtual:remix/server-build");
  const handler = createRequestHandler(build, "development");
  return handler(c.req.raw, {
    cloudflare: {
      env: c.env,
    },
  } as AppLoadContext);
});

export default app;

export const setProcessEnv = (env: Env) => {
  const store = getContext();
  if (!store) {
    throw new Error("Session context is not initialized");
  }
  store.env = env;
  if (!Object.getOwnPropertyDescriptor(process, "env")?.get) {
    const processEnv = process.env;
    Object.defineProperty(process, "env", {
      get() {
        return { ...processEnv, ...store.env };
      },
    });
  }
};
