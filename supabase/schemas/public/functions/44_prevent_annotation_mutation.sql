CREATE OR REPLACE FUNCTION public.prevent_annotation_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (
        OLD.observation_id IS DISTINCT FROM NEW.observation_id OR
        OLD.scientific_name IS DISTINCT FROM NEW.scientific_name OR
        OLD.bbox_x IS DISTINCT FROM NEW.bbox_x OR
        OLD.bbox_y IS DISTINCT FROM NEW.bbox_y OR
        OLD.bbox_w IS DISTINCT FROM NEW.bbox_w OR
        OLD.bbox_h IS DISTINCT FROM NEW.bbox_h OR
        OLD.confidence IS DISTINCT FROM NEW.confidence OR
        OLD.source IS DISTINCT FROM NEW.source OR
        OLD.version IS DISTINCT FROM NEW.version
    ) THEN
        RAISE EXCEPTION
            'observation_annotations rows are immutable. Create a new version instead.';
    END IF;
    RETURN NEW;
END;
$$;
