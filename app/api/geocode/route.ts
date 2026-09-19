import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "User-Agent": "Brewora/1.0 (contact@brewora.app)",
  "Accept-Language": "en",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");

  let url: string;
  if (type === "reverse") {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  } else {
    const q = searchParams.get("q");
    url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q!)}&format=json&limit=6&addressdetails=1`;
  }

  try {
    const res = await fetch(url, { headers: HEADERS });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(type === "reverse" ? {} : [], { status: 500 });
  }
}
