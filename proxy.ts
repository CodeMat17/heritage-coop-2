import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Public: homepage and auth routes
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);
// Protected: dashboard only
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);
// Onboarding route (requires auth)
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, redirectToSignIn } = await auth();

  // Allow all public routes without auth
  if (isPublicRoute(req)) return NextResponse.next();

  // Require auth for onboarding
  if (isOnboardingRoute(req)) {
    if (!userId) return redirectToSignIn({ returnBackUrl: req.url });
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (isDashboardRoute(req)) {
    if (!userId) return redirectToSignIn({ returnBackUrl: req.url });
    return NextResponse.next();
  }

  // Default allow other routes
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
