
// Self-contained test for the regex logic used in SQLValidator
// Regex used in the fix:
const testRegex = /^\s*(SELECT|WITH)\b/i;

const tests = [
    { sql: "CREATE TABLE foo (id int)", shouldMatch: false },
    { sql: "INSERT INTO foo VALUES (1)", shouldMatch: false },
    { sql: "UPDATE foo SET id=2", shouldMatch: false },
    { sql: "DELETE FROM foo", shouldMatch: false },
    { sql: "SELECT * FROM foo", shouldMatch: true },
    { sql: "  select * from foo", shouldMatch: true },
    { sql: "WITH cte AS (SELECT 1) SELECT * FROM cte", shouldMatch: true },
    { sql: "ALTER TABLE foo ADD COLUMN bar int", shouldMatch: false },
    { sql: "DROP TABLE foo", shouldMatch: false }
];

let failed = false;
tests.forEach(t => {
    const matched = testRegex.test(t.sql);
    if (matched !== t.shouldMatch) {
        console.error(`FAILED: "${t.sql}" -> Expected ${t.shouldMatch}, got ${matched}`);
        failed = true;
    } else {
        console.log(`PASSED: "${t.sql}"`);
    }
});

if (failed) process.exit(1);
console.log("All regex tests passed.");
