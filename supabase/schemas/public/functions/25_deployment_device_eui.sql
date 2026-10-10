-- deployments.device_eui is the camera's LoRaWAN EUI at deployment start. A client could
-- send any EUI, and lorawan-ingest used to give a camera's uplinks to the newest open
-- deployment carrying it, so one member could take another camera's messages (#323).
-- The server copies it from the device instead, for every role, on INSERT and when a
-- write changes device_id or device_eui. An update that changes neither, such as
-- push_changes's, keeps the start value even if the device's EUI changed since.
--
-- SECURITY DEFINER because any project member may deploy any camera (#320), and before
-- the deployment exists a member need not see the device under RLS. A trigger function
-- cannot be called directly, so it shows a client nothing.
CREATE OR REPLACE FUNCTION public.copy_deployment_device_eui()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.device_id IS DISTINCT FROM OLD.device_id
     OR NEW.device_eui IS DISTINCT FROM OLD.device_eui THEN
    NEW.device_eui := (SELECT d.device_eui FROM public.devices AS d WHERE d.id = NEW.device_id);
  END IF;
  RETURN NEW;
END;
$$;
