import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/not-admin",
]);

const isAdminRoute = createRouteMatcher(["/dashboard/admin(.*)"]);

// Keep in sync with AdminRole in convex/lib/adminAuth.ts — Convex functions
// can't import from this app/ file, so the list is intentionally duplicated.
const ADMIN_ROLES = ["content-admin", "finance-admin", "assist-admin", "finance-assist-admin", "super-admin"];

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId, redirectToSignIn, sessionClaims } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url });

  if (isAdminRoute(req)) {
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    if (!role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL("/not-admin", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
