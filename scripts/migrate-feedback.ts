import postgres from "postgres";

const sql = postgres("postgresql://trace_ops:trace_ops_dev@127.0.0.1:5432/trace");

// Use the trace_ops user but with superuser granting rights via a separate connection
const admin = postgres("postgresql://postgres:postgres@127.0.0.1:5432/trace");

async function migrate() {
  await admin`
    CREATE TABLE IF NOT EXISTS ops.feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chapter_id UUID REFERENCES ops.chapters(id),
      reporter_id UUID,
      callsign VARCHAR(64),
      type VARCHAR(16) NOT NULL DEFAULT 'bug',
      title VARCHAR(256) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(16) DEFAULT 'medium',
      page VARCHAR(128),
      metadata JSONB DEFAULT '{}',
      status VARCHAR(16) DEFAULT 'open',
      operator_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
  await admin`CREATE INDEX IF NOT EXISTS feedback_chapter_status ON ops.feedback(chapter_id, status)`;
  await admin`GRANT SELECT, INSERT, UPDATE ON ops.feedback TO trace_ops`;
  console.log("OK: feedback table created");
  await admin.end();
  await sql.end();
  process.exit(0);
}

migrate().catch((e) => { console.error(e.message); process.exit(1); });
