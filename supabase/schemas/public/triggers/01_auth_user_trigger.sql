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
  -- position()/substring(... from ...) are SQL-syntax constructs (not search_path
  -- resolved); split_part is a catalog function so qualify it for search_path=''.
  IF position(' ' IN v_name) > 0 THEN
    v_firstname := pg_catalog.split_part(v_name, ' ', 1);
    v_surname := substring(v_name from position(' ' IN v_name) + 1);
  ELSE
    v_firstname := v_name;
    v_surname := pg_catalog.split_part(NEW.email, '@', 1);
  END IF;

  -- Create public.users entry (email mirrored so public views avoid auth.users)
  INSERT INTO public.users (id, firstname, surname, email, modified_by)
  VALUES (NEW.id, v_firstname, v_surname, NEW.email, NEW.id);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger that fires after auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Keep public.users.email in sync when a user changes their auth email.
-- Lets public views read email from public.users instead of the restricted
-- auth.users (which 403s for the authenticated role under security_invoker).
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET email = NEW.email, updated_at = pg_catalog.now()
  WHERE id = NEW.id AND email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END;
-- search_path='' (project standard, SKILL.md §4): fully-qualify all calls to prevent
-- search-path hijacking of this SECURITY DEFINER function.
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_email();