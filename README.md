# remix-hono-workers

Remix via Hono on Cloudflare Workers and process.env.

## create app

```sh
npm create cloudflare@latest . -- --framework=remix --experimental
```

## vite.config.ts

Enabling Hono

```ts
import { defineConfig } from "vite";
import { vitePlugin as remix } from "@remix-run/dev";
import tsconfigPaths from "vite-tsconfig-paths";
import adapter from "@hono/vite-dev-server/cloudflare";
import serverAdapter from "hono-remix-adapter/vite";

declare module "@remix-run/cloudflare" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    serverAdapter({
      adapter,
      entry: "server.ts",
    }),
    tsconfigPaths(),
  ],
  ssr: {
    resolve: {
      conditions: ["workerd", "worker", "browser"],
      externalConditions: ["workerd", "worker"],
    },
  },
  resolve: {
    mainFields: ["browser", "module", "main"],
  },
  build: {
    minify: true,
  },
});
```

## server.ts

```ts
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
        return { ...processEnv, ...getContext().env };
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
```

## app/routes/\_index.tsx

```tsx
import { useLoaderData } from "@remix-run/react";

export default function Index() {
  const value = useLoaderData<string>();
  return <pre>{value}</pre>;
}

// At the point of module execution, process.env is available.
const value = JSON.stringify(process.env, null, 2);

export const loader = () => {
  return value;
};
```

## wrangler.toml

```toml
#:schema node_modules/wrangler/config-schema.json
name = "remix-hono-workers"
compatibility_date = "2024-11-12"
compatibility_flags = ["nodejs_compat"]
main = "./server.ts"
assets = { directory = "./build/client" }

# Workers Logs
# Docs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
# Configuration: https://developers.cloudflare.com/workers/observability/logs/workers-logs/#enable-workers-logs
[observability]
enabled = true

[vars]
a = "123"
```
