import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("schema upgrades a legacy speaking records table before creating its index", async () => {
  const db = new PGlite();
  try {
    await db.query(`
      CREATE TABLE speaking_practice_records (
        id TEXT PRIMARY KEY,
        record_data JSONB NOT NULL CHECK (jsonb_typeof(record_data) = 'object'),
        created_at TEXT NOT NULL DEFAULT ''
      )
    `);

    const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
    for (const statement of schema.split(";")) {
      if (statement.trim()) await db.query(statement);
    }

    const result = await db.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'speaking_practice_records'
    `);
    const columns = new Set(result.rows.map((row) => row.column_name));
    assert.equal(columns.has("class_id"), true);
    assert.equal(columns.has("class_name"), true);
    assert.equal(columns.has("seat"), true);

    const classes = await db.query<{ id: number }>(
      "INSERT INTO classes(name) VALUES ('206') RETURNING id",
    );
    const classId = classes.rows[0].id;
    await db.query("INSERT INTO class_seats(class_id,seat) VALUES ($1,1)", [classId]);
    await db.query(
      `INSERT INTO speaking_practice_records(id,class_id,class_name,seat,record_data,created_at)
       VALUES ('test-record',$1,'206',1,$2::text::jsonb,'2026-09-07T00:00:00.000Z')`,
      [classId, JSON.stringify({ type: "reading", score: 100 })],
    );

    const count = await db.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM speaking_practice_records",
    );
    assert.equal(count.rows[0].count, 1);
  } finally {
    await db.close();
  }
});
