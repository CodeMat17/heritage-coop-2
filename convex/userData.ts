import { query } from "./_generated/server";
import { getCurrentUser } from "./users";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return await ctx.db
      .query("userData")
      .withIndex("byUserId", (q) => q.eq("userId", user._id))
      .unique();
  },
});
