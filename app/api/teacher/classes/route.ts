import { NextResponse } from "next/server";
import { isTeacherAuthenticated } from "@/lib/auth";
import { getClasses } from "@/lib/queries";

export async function GET() {
  if (!(await isTeacherAuthenticated())) return NextResponse.json({ error: "老師登入已失效" }, { status: 401 });
  const classes = (await getClasses()).map((classroom) => ({
    id: String(classroom.id), name: classroom.name, seats: classroom.seats.map(String),
  }));
  return NextResponse.json({ classes });
}
