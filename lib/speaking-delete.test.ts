import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { articleBackupId, buildSpeakingDeleteQuery } from "./speaking-delete";

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
  for (const content of ["Article one.", "Article two."]) {
    await db.query(
      "INSERT INTO speaking_articles(content,created_at,updated_at) VALUES ($1,$2,$2)",
      [content, "2026-01-01 00:00"],
    );
  }
  return db;
}

async function runDelete(db: PGlite, filter: Parameters<typeof buildSpeakingDeleteQuery>[0], backupId = "b1") {
  const { text, params } = buildSpeakingDeleteQuery(filter, backupId, "2026-02-01 00:00");
  const { rows } = await db.query<{ backup_id: string | null; cleared: number; cleared_articles: number }>(text, params);
  const left = await db.query<{ id: string }>("SELECT id FROM speaking_practice_records ORDER BY id");
  const articles = await db.query<{ id: number }>("SELECT id FROM speaking_articles");
  return { ...rows[0], left: left.rows.map((row) => row.id), articlesLeft: articles.rows.length };
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

// 換學期：清空全部連朗讀文章一起，老師才不用一篇一篇刪
test("clearing everything also backs up and removes the articles", async () => {
  const db = await seed();
  try {
    const result = await runDelete(db, { scope: "all" });
    assert.equal(Number(result.cleared_articles), 2);
    assert.equal(result.articlesLeft, 0);

    const backup = await db.query<{ records: { content: string }[] }>(
      "SELECT records FROM speaking_practice_record_backups WHERE id=$1",
      [articleBackupId("b1")],
    );
    assert.deepEqual(backup.rows[0].records.map((row) => row.content), ["Article one.", "Article two."]);
  } finally {
    await db.close();
  }
});

// 刪一筆或刪一位學生時文章不能跟著消失
test("a narrower delete leaves the articles alone", async () => {
  const db = await seed();
  try {
    const record = await runDelete(db, { scope: "record", id: "r2" });
    assert.equal(Number(record.cleared_articles), 0);
    assert.equal(record.articlesLeft, 2);

    const student = await runDelete(db, { scope: "student", className: "A班", student: "7" }, "b2");
    assert.equal(Number(student.cleared_articles), 0);
    assert.equal(student.articlesLeft, 2);
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
