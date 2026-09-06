import { NextResponse } from "next/server";
import { getClasses } from "@/lib/queries";

export async function GET() {
  const classes = (await getClasses()).map((classroom) => ({
    id: String(classroom.id), name: classroom.name, seats: classroom.seats.map(String),
  }));
  return NextResponse.json({ classes });
}
