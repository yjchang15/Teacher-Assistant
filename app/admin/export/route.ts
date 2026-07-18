import { type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getMatrix } from "@/lib/queries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: NextRequest) {
  const today = todayInTaipei();
  const startParam = req.nextUrl.searchParams.get("start") ?? "";
  const endParam = req.nextUrl.searchParams.get("end") ?? "";
  const requestedStart = ISO_DATE.test(startParam) ? startParam : today;
  const requestedEnd = ISO_DATE.test(endParam) ? endParam : today;
  const rawStart = requestedStart <= today ? requestedStart : today;
  const rawEnd = requestedEnd <= today ? requestedEnd : today;
  const start = rawStart <= rawEnd ? rawStart : rawEnd;
  const end = rawStart <= rawEnd ? rawEnd : rawStart;
  const matrix = await getMatrix(start, end);
  const rows = matrix.rows.filter((row) => row.total > 0);

  const header = ["座號", ...matrix.subjects, "未交合計"];
  const body = rows.map((row) => [
    row.seat,
    ...matrix.subjects.map((subject) => row.counts[subject] ?? 0),
    row.total,
  ]);
  const footer = ["合計", ...matrix.subjects.map((subject) => matrix.colTotals[subject] ?? 0), matrix.grandTotal];
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body, footer]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "未交作業統計");
  const buffer: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="homework-${start}_${end}.xlsx"`,
    },
  });
}
