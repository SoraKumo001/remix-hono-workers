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
```

## app/routes/\_index.tsx

```tsx
import { useLoaderData } from "@remix-run/react";
import { prisma } from "~/libs/prisma";

export default function Index() {
  const value = useLoaderData<string>();
  return <div>{value}</div>;
}

export async function loader(): Promise<string> {
  //You can directly use the PrismaClient instance received from the module
  const users = await prisma.user.findMany();
  return JSON.stringify(users);
}
```

## app/libs/prisma.ts

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getContext } from "hono/context-storage";

type Env = {
  Variables: {
    prisma: PrismaClient;
  };
};

// Create a proxy that returns a PrismaClient instance on SessionContext with the variable name prisma
export const prisma = new Proxy<PrismaClient>({} as never, {
  get(_target: unknown, props: keyof PrismaClient) {
    const context = getContext<Env>();
    if (!context.get("prisma")) {
      const adapter = new PrismaD1(process.env.DB as unknown as D1Database);
      context.set("prisma", new PrismaClient({ adapter }));
    }
    return context.get("prisma")[props];
  },
});
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

[[d1_databases]]
binding = "DB" # i.e. available in your Worker on env.DB
database_name = "prisma-demo-db"
database_id = "03b35086-e3b9-4c54-94ac-fac685f207c5"
```
