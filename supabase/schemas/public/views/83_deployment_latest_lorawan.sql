-- deployment_latest_lorawan: each deployment's newest LoRaWAN message, with the battery level
-- and SD card use parsed from it, for the website's Realtime page (#333). One row per
-- deployment. security_invoker, so lorawan_messages_select_policy decides which: the
-- deployment's project and ww_admin (#323). A filter on deployment_id reads
-- lorawan_messages_deployment_received_idx.
CREATE OR REPLACE VIEW public.deployment_latest_lorawan
WITH (security_invoker = true) AS
SELECT DISTINCT ON (m.deployment_id)
  m.deployment_id,
  m.received_at,
  p.battery_level,
  p.sd_card_used_capacity
FROM public.lorawan_messages AS m
LEFT JOIN public.lorawan_parsed_messages AS p ON m.id = p.lorawan_message_id
WHERE
  m.deployment_id IS NOT null
  AND m.received_at IS NOT null
ORDER BY m.deployment_id ASC, m.received_at DESC;

GRANT SELECT ON public.deployment_latest_lorawan TO authenticated;
