import * as XLSX from "xlsx";
import { getAllMissingDetails } from "@/lib/queries";

export async function GET() {
  const rows = await getAllMissingDetails();
  const header = ["班級", "座號", "日期", "作業項目", "作業內容"];
  const body = rows.map((row) => [row.class_name, row.seat, row.date, row.title, row.description]);
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 28 },
    { wch: 50 },
  ];
  worksheet["!autofilter"] = { ref: `A1:E${Math.max(1, body.length + 1)}` };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "全部未交作業");
  const buffer: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="all-missing-homework.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
