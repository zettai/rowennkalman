import { NextResponse } from "next/server";

/**
 * A 303 to a same-site path with a RELATIVE Location, so the browser stays on the host it is on.
 * Do not build redirects from req.url: on Netlify it can be the deploy's own
 * <id>--rowennkalman.netlify.app address, where the rowennkalman.com session cookie does not
 * exist, so signing in looped back to the login form (2026-09-30).
 */
export function seeOther(path: string): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`seeOther: not a same-site path: ${path}`);
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}
