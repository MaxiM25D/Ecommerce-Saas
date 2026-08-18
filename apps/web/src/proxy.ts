import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const platformHosts = new Set(
  (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);
const apiUrl =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000/api";

export async function proxy(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "")
    .split(":")[0]!
    .toLowerCase();
  if (
    !hostname ||
    platformHosts.has(hostname) ||
    hostname.endsWith(".localhost") ||
    request.nextUrl.pathname.startsWith("/tienda/")
  )
    return NextResponse.next();
  try {
    const response = await fetch(
      `${apiUrl}/storefront/resolve-domain/${encodeURIComponent(hostname)}`,
      { next: { revalidate: 300 } },
    );
    if (!response.ok) return NextResponse.next();
    const { slug } = (await response.json()) as { slug: string };
    const path =
      request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname;
    return NextResponse.rewrite(
      new URL(
        `/tienda/${encodeURIComponent(slug)}${path}${request.nextUrl.search}`,
        request.url,
      ),
    );
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|admin|platform|login|recuperar-clave|restablecer-clave|verificar-email|invitacion).*)",
  ],
};
