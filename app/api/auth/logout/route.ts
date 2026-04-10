import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333";

export async function POST() {
  const response = NextResponse.redirect(`${APP_URL}/login`);
  response.cookies.delete("jettauth");
  response.cookies.delete("x_refresh_token");
  response.cookies.delete("x_profile");
  return response;
}

export async function GET() {
  return POST();
}
