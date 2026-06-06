CREATE TABLE public.annotation_targets (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_job_id    UUID NOT NULL REFERENCES public.annotation_jobs(id) ON DELETE CASCADE,
    deployment_id        UUID NOT NULL REFERENCES public.deployments(id) ON DELETE CASCADE,
    media_id             UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    observation_id       UUID REFERENCES public.observations(id) ON DELETE SET NULL,
    dataset_name         TEXT NOT NULL,
    fiftyone_sample_id   TEXT,
    cvat_task_id         INT,
    cvat_job_id          INT,
    cvat_frame_index     INT,
    cvat_shape_ids       INT[] DEFAULT '{}',
    status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN (
                             'pending', 'assigned', 'annotating',
                             'reviewing', 'approved', 'rejected', 'synced', 'failed'
                         )),
    synced_at            TIMESTAMPTZ,
    error_message        TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_at_job_media ON public.annotation_targets(annotation_job_id, media_id);
CREATE INDEX idx_at_media_id ON public.annotation_targets(media_id);
CREATE INDEX idx_at_observation_id ON public.annotation_targets(observation_id);
CREATE INDEX idx_at_cvat_task ON public.annotation_targets(cvat_task_id);
CREATE INDEX idx_at_cvat_job ON public.annotation_targets(cvat_job_id);
CREATE INDEX idx_at_status ON public.annotation_targets(status);

ALTER TABLE public.annotation_targets ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.annotation_targets TO authenticated;
GRANT ALL ON public.annotation_targets TO service_role;
