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
