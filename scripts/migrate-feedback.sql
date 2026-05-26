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
);
CREATE INDEX IF NOT EXISTS feedback_chapter_status ON ops.feedback(chapter_id, status);
GRANT SELECT, INSERT, UPDATE ON ops.feedback TO trace_ops;
