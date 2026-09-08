// 刪除口說練習紀錄的 SQL 組裝。
//
// 獨立成純模組有兩個理由：一是 lib/speaking.ts 匯入了 server-only，node --test
// 載不進來；二是刪除是不可逆的操作，條件怎麼組出來值得單獨測。

export type SpeakingDeleteFilter =
  | { scope: "all" }
  | { scope: "record"; id: string }
  | { scope: "student"; className: string; student: string };

// 清空全部是「換一個學期」用的，所以朗讀文章要跟著練習紀錄一起清掉，老師才能
// 從空的開始重新設定。文章的快照另外存成一列，備份 ID 由紀錄那份加上後綴。
export const articleBackupId = (backupId: string) => `${backupId}-articles`;

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

  // 文章跟紀錄各自備份、各自守著自己的備份，其中一邊沒東西可刪不影響另一邊。
  const wipesArticles = filter.scope === "all";
  if (wipesArticles) params.push(articleBackupId(backupId));

  const articleCtes = wipesArticles
    ? `, article_source AS MATERIALIZED (
       SELECT id,content,created_at,updated_at FROM speaking_articles ORDER BY id
     ), article_saved AS (
       INSERT INTO speaking_practice_record_backups(id,records,created_at)
       SELECT $3,jsonb_agg(jsonb_build_object(
         'id',id,'content',content,'createdAt',created_at,'updatedAt',updated_at) ORDER BY id),$2
       FROM article_source HAVING COUNT(*)>0 RETURNING id
     ), articles_deleted AS (
       DELETE FROM speaking_articles
       WHERE id IN (SELECT id FROM article_source) AND EXISTS (SELECT 1 FROM article_saved) RETURNING id
     )`
    : "";

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
     )${articleCtes}
     SELECT (SELECT id FROM saved) AS backup_id,
       (SELECT COUNT(*) FROM deleted)::int AS cleared,
       ${wipesArticles ? "(SELECT COUNT(*) FROM articles_deleted)::int" : "0"} AS cleared_articles`;

  return { text, params };
}
