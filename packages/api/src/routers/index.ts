import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import { assignmentsRouter } from "./assignments";
import { evaluationsRouter } from "./evaluations";
import { judgesRouter } from "./judges";
import { submissionsRouter } from "./submissions";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => "OK"),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),

  // Submissions routes
  submissions: submissionsRouter,

  // Judges routes
  judges: judgesRouter,

  // Assignments routes
  assignments: assignmentsRouter,

  // Evaluations routes
  evaluations: evaluationsRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
