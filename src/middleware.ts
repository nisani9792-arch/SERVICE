import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

function isMobileDevice(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (MOBILE_UA.test(ua)) return true;
  const chMobile = request.headers.get("sec-ch-ua-mobile");
  return chMobile === "?1";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    const dest = isMobileDevice(request) ? "/mobile/triage" : "/dashboard";
    return NextResponse.redirect(new URL(dest + search, request.url));
  }

  if (pathname === "/focus" || pathname === "/review" || pathname === "/triage") {
    const queue =
      pathname === "/triage"
        ? "triage"
        : pathname === "/review"
          ? "active"
          : request.nextUrl.searchParams.get("queue") ?? "active";
    const sp = new URLSearchParams(search);
    if (!sp.has("queue")) sp.set("queue", queue);
    return NextResponse.redirect(new URL(`/mobile/triage?${sp}`, request.url));
  }

  if (pathname === "/inbox") {
    return NextResponse.redirect(new URL(`/dashboard/inbox${search}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/focus", "/review", "/triage", "/inbox"]
};
