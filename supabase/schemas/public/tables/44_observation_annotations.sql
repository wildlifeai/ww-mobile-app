CREATE TABLE public.observation_annotations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id  UUID NOT NULL REFERENCES public.observations(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    parent_id       UUID REFERENCES public.observation_annotations(id) ON DELETE SET NULL,
    source          TEXT NOT NULL
                    CHECK (source IN (
                        'ml_model', 'camtrapdp', 'cvat', 'ww_canvas', 'qa_review'
                    )),
    priority        INT NOT NULL
                    GENERATED ALWAYS AS (
                        CASE source
                            WHEN 'ml_model'   THEN 1
                            WHEN 'camtrapdp'  THEN 2
                            WHEN 'cvat'       THEN 3
                            WHEN 'ww_canvas'  THEN 4
                            WHEN 'qa_review'  THEN 5
                            ELSE 0
                        END
                    ) STORED,
    scientific_name TEXT,
    bbox_x          REAL CHECK (bbox_x IS NULL OR (bbox_x >= 0 AND bbox_x <= 1)),
    bbox_y          REAL CHECK (bbox_y IS NULL OR (bbox_y >= 0 AND bbox_y <= 1)),
    bbox_w          REAL CHECK (bbox_w IS NULL OR (bbox_w >= 0 AND bbox_w <= 1)),
    bbox_h          REAL CHECK (bbox_h IS NULL OR (bbox_h >= 0 AND bbox_h <= 1)),
    confidence      REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    attributes      JSONB DEFAULT '{}',
    is_current      BOOLEAN NOT NULL DEFAULT FALSE,
    review_status   TEXT DEFAULT 'unreviewed'
                    CHECK (review_status IN ('unreviewed', 'approved', 'rejected')),
    review_note     TEXT,
    reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    annotation_job_id    UUID REFERENCES public.annotation_jobs(id) ON DELETE SET NULL,
    annotation_target_id UUID REFERENCES public.annotation_targets(id) ON DELETE SET NULL,
    source_ref           TEXT
);

CREATE UNIQUE INDEX idx_oa_current_per_obs ON public.observation_annotations(observation_id) WHERE is_current = TRUE;
CREATE UNIQUE INDEX idx_oa_version_per_obs ON public.observation_annotations(observation_id, version);
CREATE INDEX idx_oa_observation ON public.observation_annotations(observation_id);
CREATE INDEX idx_oa_source ON public.observation_annotations(source);
CREATE INDEX idx_oa_job ON public.observation_annotations(annotation_job_id);
CREATE INDEX idx_oa_is_current ON public.observation_annotations(is_current);

ALTER TABLE public.observation_annotations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.observation_annotations TO authenticated;
GRANT ALL ON public.observation_annotations TO service_role;
