CREATE TABLE public.annotation_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id   UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
    dataset_name    TEXT NOT NULL,
    anno_key        TEXT NOT NULL UNIQUE,
    backend         TEXT NOT NULL DEFAULT 'cvat'
                    CHECK (backend IN ('cvat', 'labelstudio', 'manual')),
    label_classes   TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN (
                        'pending', 'assigned', 'annotating',
                        'reviewing', 'approved', 'rejected', 'synced', 'failed'
                    )),
    sample_count    INT,
    completed_count INT DEFAULT 0,
    snapshot_media_ids  UUID[]  DEFAULT '{}',
    snapshot_hash       TEXT,
    snapshot_created_at TIMESTAMPTZ DEFAULT NOW(),
    workflow_config JSONB NOT NULL DEFAULT '{
        "requires_review": false,
        "min_annotators": 1,
        "min_reviewers": 0,
        "auto_approve_threshold": null,
        "writeback_trigger": "annotating_complete",
        "rejection_returns_to": "annotating",
        "cvat_task_retention_days": 14
    }',
    cvat_task_ids   INT[]   DEFAULT '{}',
    cvat_project_id INT,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    synced_at       TIMESTAMPTZ,
    observations_updated INT DEFAULT 0,
    error_message   TEXT
);

CREATE INDEX idx_annotation_jobs_deployment ON public.annotation_jobs(deployment_id);
CREATE INDEX idx_annotation_jobs_status ON public.annotation_jobs(status);
CREATE INDEX idx_annotation_jobs_anno_key ON public.annotation_jobs(anno_key);

ALTER TABLE public.annotation_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.annotation_jobs TO authenticated;
GRANT ALL ON public.annotation_jobs TO service_role;
