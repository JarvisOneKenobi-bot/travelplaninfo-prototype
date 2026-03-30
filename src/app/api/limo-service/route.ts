import { NextResponse } from "next/server";

// Placeholder for airportspickup.com limo booking integration
// TODO: Wire to airportspickup.com API for direct booking within TPI
export async function GET() {
  return NextResponse.json({
    available: false,
    provider: "airportspickup.com",
    quoteUrl: "https://airportspickup.com/quote-reserve/",
  });
}
