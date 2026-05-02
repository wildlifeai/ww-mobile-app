CREATE TABLE api_jobs (
  id uuid PRIMARY KEY NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  job_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE api_jobs IS 'Stores background job states from the backend API for recovery and persistence.';

ALTER TABLE api_jobs ENABLE ROW LEVEL SECURITY;

GRANT ALL PRIVILEGES ON TABLE api_jobs TO service_role;
GRANT SELECT ON TABLE api_jobs TO authenticated;
