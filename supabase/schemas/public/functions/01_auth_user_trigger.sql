-- Trigger to automatically create public.users entry when auth.users is created
-- This ensures UUID consistency between auth.users and public.users
-- MVP2: Also assigns new users to the General organisation by default using user_roles

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  general_org_id uuid;
  v_firstname text;
  v_surname text;
  v_name text;
BEGIN
  -- Extract name from metadata or email
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);

  -- Split name into firstname and surname
  -- If name contains space, split on first space
  -- Otherwise, use full name as firstname and email domain as surname
  IF position(' ' IN v_name) > 0 THEN
    v_firstname := split_part(v_name, ' ', 1);
    v_surname := substring(v_name from position(' ' IN v_name) + 1);
  ELSE
    v_firstname := v_name;
    v_surname := split_part(NEW.email, '@', 1);
  END IF;

  -- Create public.users entry
  INSERT INTO public.users (id, firstname, surname, modified_by)
  VALUES (NEW.id, v_firstname, v_surname, NEW.id);

  -- MVP2: Auto-assign to General organisation
  -- Get the General organisation ID (slug = 'general')
  SELECT id INTO general_org_id
  FROM public.organisations
  WHERE slug = 'general'
  AND deleted_at IS NULL
  LIMIT 1;

  -- Only assign if General organisation exists
  IF general_org_id IS NOT NULL THEN
    -- Check if user-role association already exists (not deleted)
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.id
      AND scope_type = 'organisation'
      AND scope_id = general_org_id
      AND role = 'organisation_member'
      AND deleted_at IS NULL
    ) THEN
      INSERT INTO public.user_roles (
        user_id, 
        role, 
        scope_type, 
        scope_id, 
        granted_by,
        modified_by,
        is_active
      )
      VALUES (
        NEW.id, 
        'organisation_member', 
        'organisation', 
        general_org_id, 
        NEW.id, -- Self-granted via system trigger
        NEW.id, -- Modified by self (system trigger)
        true
      );
    END IF;
  END IF;

  RAISE NOTICE 'Auto-assigning user % to General organisation (%)', NEW.id, general_org_id;
  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to auto-assign user to General organisation: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

-- Trigger that fires after auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
