import { APIError } from "better-auth/api";
import { defineAuth } from "void/auth";
import { checkOwnerSignup } from "./src/lib/signup-policy.ts";

export const SIGNUP_CODE_HEADER = "x-signup-code";

export default defineAuth(({ defaults, env }) => ({
  ...defaults,
  databaseHooks: {
    ...defaults.databaseHooks,
    user: {
      ...defaults.databaseHooks?.user,
      create: {
        ...defaults.databaseHooks?.user?.create,
        before: async (user, context) => {
          const providedCode = context?.headers?.get(SIGNUP_CODE_HEADER) ?? context?.request?.headers.get(SIGNUP_CODE_HEADER);
          const reason = checkOwnerSignup({ email: user.email, ownerEmail: env.OWNER_EMAIL, signupCode: env.OWNER_SIGNUP_CODE, providedCode });
          if (reason) throw new APIError("FORBIDDEN", { message: reason });
        },
      },
    },
  },
}));
