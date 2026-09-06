import { NextResponse } from "next/server";
import { getClasses } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const classes = (await getClasses()).map((classroom) => ({
      id: String(classroom.id),
      name: classroom.name,
      seats: classroom.seats.map(String),
    }));
    return NextResponse.json({ classes });
  } catch (error) {
    console.error("讀取班級失敗", error);
    return NextResponse.json({ error: "伺服器無法讀取班級名冊" }, { status: 500 });
  }
}
