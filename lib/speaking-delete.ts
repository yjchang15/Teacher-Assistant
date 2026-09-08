// 刪除口說練習紀錄的條件解析與 SQL 組裝。
//
// 獨立成純模組有兩個理由：一是 lib/speaking.ts 匯入了 server-only，node --test
// 載不進來；二是刪除是不可逆的操作，條件怎麼組出來值得單獨測。

export type SpeakingDeleteFilter =
  | { scope: "all" }
  | { scope: "record"; id: string }
  | { scope: "student"; className: string; student: string };

/**
 * 解析 DELETE /api/teacher/records 的查詢字串。
 *
 * - `?id=r123`                    → 只刪這一筆
 * - `?className=五年一班&student=7` → 刪這位學生在這個班的全部紀錄
 * - 什麼都不帶                     → 清空全部（維持原本的行為）
 *
 * 「未分班」的班名本身就是空字串，所以用「有沒有帶 className 這個參數」判斷，
 * 不能用值是不是空的判斷。
 */
export function parseSpeakingDeleteFilter(
  params: URLSearchParams,
): { filter?: SpeakingDeleteFilter; error?: string } {
  const id = (params.get("id") || "").trim();
  const student = (params.get("student") || "").trim();
  const hasClassName = params.has("className");

  if (id) return { filter: { scope: "record", id } };
  if (student) {
    if (!hasClassName) return { error: "刪除單一學生的紀錄時必須指定班級" };
    return { filter: { scope: "student", className: params.get("className") ?? "", student } };
  }
  if (hasClassName) return { error: "請一併指定要刪除的座號" };
  return { filter: { scope: "all" } };
}

/**
 * 組出「先備份、再刪除」的單一語句。備份與刪除在同一個 CTE 裡完成，備份寫不進去
 * 就不會刪到任何一列。
 *
 * 條件片段只由本檔案的字面字串拼出來，老師輸入的值一律走 $n 參數。
 */
export function buildSpeakingDeleteQuery(
  filter: SpeakingDeleteFilter,
  backupId: string,
  now: string,
): { text: string; params: unknown[] } {
  const params: unknown[] = [backupId, now];
  let where = "TRUE";

  if (filter.scope === "record") {
    params.push(filter.id);
    where = "id=$3";
  } else if (filter.scope === "student") {
    // 比對 record_data 而不是 class_name / seat 欄位：老師在畫面上看到的班級與
    // 座號就是從 record_data 來的，而舊資料那兩個欄位可能是 NULL。
    params.push(filter.className, filter.student);
    where =
      "COALESCE(record_data->>'className','')=$3 AND COALESCE(record_data->>'student',record_data->>'seatNo','')=$4";
  }

  const text = `WITH source AS MATERIALIZED (
       SELECT id,created_at,record_data FROM speaking_practice_records
       WHERE ${where} ORDER BY created_at,id
     ), saved AS (
       INSERT INTO speaking_practice_record_backups(id,records,created_at)
       SELECT $1,jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at) || record_data),$2
       FROM source HAVING COUNT(*)>0 RETURNING id
     ), deleted AS (
       DELETE FROM speaking_practice_records
       WHERE id IN (SELECT id FROM source) AND EXISTS (SELECT 1 FROM saved) RETURNING id
     )
     SELECT (SELECT id FROM saved) AS backup_id,COUNT(*)::int AS cleared FROM deleted`;

  return { text, params };
}
