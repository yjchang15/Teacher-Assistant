// Installs the browser test harness into public/speaking so it can be loaded
// from the dev server, and removes it again afterwards. It lives outside
// public/ the rest of the time: the harness page can write practice records,
// and nothing that does that belongs on the site students open.
//
//   node test/speaking/harness.mjs install
//   npm run dev                     # then open /speaking/_test.html
//   node test/speaking/harness.mjs remove
//
// In the page: await runTests('desktop' | 'slow' | 'phone'), which returns
// { total, passed, failed }. Add ?phone=1 to make the app believe it is on an
// Android phone. Requires one class with seats and one article in the database.
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "..", "public", "speaking");
const files = [["stubs.js", "_test-stubs.js"], ["scenarios.js", "_test-run.js"]];
const page = join(target, "_test.html");

if (process.argv[2] === "install") {
  for (const [from, to] of files) copyFileSync(join(here, from), join(target, to));
  // Generated from index.html every time, so the harness cannot drift from the
  // real page's markup.
  const html = readFileSync(join(target, "index.html"), "utf8").replace(
    '<script src="app.js"></script>',
    '<script src="_test-stubs.js"></script>\n<script src="app.js"></script>\n<script src="_test-run.js"></script>',
  );
  writeFileSync(page, html);
  console.log("harness installed at /speaking/_test.html");
} else if (process.argv[2] === "remove") {
  for (const [, to] of files) rmSync(join(target, to), { force: true });
  rmSync(page, { force: true });
  console.log("harness removed");
} else {
  console.error("usage: node test/speaking/harness.mjs install|remove");
  process.exit(1);
}
