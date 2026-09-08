import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { buildSpeakingDeleteQuery, parseSpeakingDeleteFilter } from "./speaking-delete";

const filterOf = (search: string) => parseSpeakingDeleteFilter(new URLSearchParams(search));

test("parses the delete scope from the query string", () => {
  assert.deepEqual(filterOf("").filter, { scope: "all" });
  assert.deepEqual(filterOf("id=r1").filter, { scope: "record", id: "r1" });
  assert.deepEqual(filterOf("className=A班&student=7").filter, {
    scope: "student", className: "A班", student: "7",
  });
  // 未分班的班名就是空字串，帶了參數就算指定過班級
  assert.deepEqual(filterOf("className=&student=7").filter, {
    scope: "student", className: "", student: "7",
  });
});

test("rejects a student delete that would spill across classes", () => {
  assert.equal(filterOf("student=7").error, "刪除單一學生的紀錄時必須指定班級");
  assert.equal(filterOf("className=A班").error, "請一併指定要刪除的座號");
  assert.equal(filterOf("student=7").filter, undefined);
});

async function seed() {
  const db = new PGlite();
  const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  for (const statement of schema.split(";")) {
    if (statement.trim()) await db.query(statement);
  }
  const rows: [string, string, number, Record<string, unknown>][] = [
    ["r1", "A班", 7, { type: "reading", student: "7", seatNo: "7", className: "A班", score: 90 }],
    ["r2", "A班", 7, { type: "conversation", student: "7", seatNo: "7", className: "A班", userTurnCount: 3 }],
    ["r3", "A班", 8, { type: "reading", student: "8", seatNo: "8", className: "A班", score: 60 }],
    ["r4", "B班", 7, { type: "reading", student: "7", seatNo: "7", className: "B班", score: 70 }],
  ];
  for (const [id, className, seat, data] of rows) {
    await db.query(
      `INSERT INTO speaking_practice_records(id,class_name,seat,record_data,created_at)
       VALUES ($1,$2,$3,$4::text::jsonb,$5)`,
      [id, className, seat, JSON.stringify(data), `2026-01-0${seat} 00:00`],
    );
  }
  return db;
}

async function runDelete(db: PGlite, filter: Parameters<typeof buildSpeakingDeleteQuery>[0]) {
  const { text, params } = buildSpeakingDeleteQuery(filter, "b1", "2026-02-01 00:00");
  const { rows } = await db.query<{ backup_id: string | null; cleared: number }>(text, params);
  const left = await db.query<{ id: string }>("SELECT id FROM speaking_practice_records ORDER BY id");
  return { ...rows[0], left: left.rows.map((row) => row.id) };
}

test("deleting one record leaves every other record alone", async () => {
  const db = await seed();
  try {
    const result = await runDelete(db, { scope: "record", id: "r2" });
    assert.equal(Number(result.cleared), 1);
    assert.equal(result.backup_id, "b1");
    assert.deepEqual(result.left, ["r1", "r3", "r4"]);

    const backup = await db.query<{ records: { id: string }[] }>(
      "SELECT records FROM speaking_practice_record_backups WHERE id='b1'",
    );
    assert.deepEqual(backup.rows[0].records.map((row) => row.id), ["r2"]);
  } finally {
    await db.close();
  }
});

test("deleting one student keeps the same seat number in other classes", async () => {
  const db = await seed();
  try {
    const result = await runDelete(db, { scope: "student", className: "A班", student: "7" });
    assert.equal(Number(result.cleared), 2);
    assert.deepEqual(result.left, ["r3", "r4"]);
  } finally {
    await db.close();
  }
});

test("clearing everything still backs up the whole table first", async () => {
  const db = await seed();
  try {
    const result = await runDelete(db, { scope: "all" });
    assert.equal(Number(result.cleared), 4);
    assert.deepEqual(result.left, []);

    const backup = await db.query<{ records: { id: string }[] }>(
      "SELECT records FROM speaking_practice_record_backups WHERE id='b1'",
    );
    assert.equal(backup.rows[0].records.length, 4);
  } finally {
    await db.close();
  }
});

test("a filter that matches nothing writes no backup and deletes nothing", async () => {
  const db = await seed();
  try {
    const result = await runDelete(db, { scope: "record", id: "nope" });
    assert.equal(Number(result.cleared), 0);
    assert.equal(result.backup_id, null);
    assert.deepEqual(result.left, ["r1", "r2", "r3", "r4"]);

    const backups = await db.query("SELECT id FROM speaking_practice_record_backups");
    assert.equal(backups.rows.length, 0);
  } finally {
    await db.close();
  }
});
