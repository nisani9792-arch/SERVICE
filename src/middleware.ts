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

function withDashboardView(request: NextRequest, view: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.searchParams.set("view", view);
  return NextResponse.redirect(url);
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const mobile = isMobileDevice(request);

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("view", mobile ? "workbench" : "command");
    return NextResponse.redirect(url);
  }

  if (pathname === "/dashboard") {
    if (!request.nextUrl.searchParams.has("view")) {
      const url = request.nextUrl.clone();
      url.searchParams.set("view", mobile ? "workbench" : "command");
      return NextResponse.redirect(url);
    }
  }

  if (pathname === "/focus" || pathname === "/review") {
    const queue =
      pathname === "/review"
        ? "active"
        : request.nextUrl.searchParams.get("queue") ?? "active";
    const sp = new URLSearchParams(search);
    if (!sp.has("queue")) sp.set("queue", queue);
    return NextResponse.redirect(new URL(`/mobile/triage?${sp}`, request.url));
  }

  if (pathname === "/inbox" || pathname.startsWith("/dashboard/inbox")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    if (!url.searchParams.has("view")) url.searchParams.set("view", "workbench");
    return NextResponse.redirect(url);
  }

  if (pathname === "/triage") {
    return withDashboardView(request, "triage");
  }
  if (pathname === "/rapid-reply") {
    return withDashboardView(request, "rapid");
  }
  if (pathname === "/trash") {
    return withDashboardView(request, "trash");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard",
    "/dashboard/inbox",
    "/dashboard/inbox/:path*",
    "/inbox",
    "/triage",
    "/rapid-reply",
    "/trash",
    "/focus",
    "/review"
  ]
};
