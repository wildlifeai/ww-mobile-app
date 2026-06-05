CREATE TABLE public.annotation_reviews (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    annotation_job_id    UUID REFERENCES public.annotation_jobs(id) ON DELETE CASCADE,
    annotation_target_id UUID REFERENCES public.annotation_targets(id) ON DELETE CASCADE,
    annotation_id        UUID REFERENCES public.observation_annotations(id) ON DELETE CASCADE,
    reviewer_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    decision             TEXT NOT NULL
                         CHECK (decision IN ('approved', 'rejected', 'flagged')),
    note                 TEXT,
    time_spent_seconds   INT,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ar_job ON public.annotation_reviews(annotation_job_id);
CREATE INDEX idx_ar_target ON public.annotation_reviews(annotation_target_id);
CREATE INDEX idx_ar_reviewer ON public.annotation_reviews(reviewer_id);

ALTER TABLE public.annotation_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.annotation_reviews TO authenticated;
GRANT ALL ON public.annotation_reviews TO service_role;
