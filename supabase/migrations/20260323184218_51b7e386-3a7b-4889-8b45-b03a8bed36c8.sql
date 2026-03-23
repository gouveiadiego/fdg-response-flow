DROP FUNCTION IF EXISTS get_ticket_tracking_info(uuid);

CREATE OR REPLACE FUNCTION get_ticket_tracking_info(p_ticket_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'code', t.code,
    'status', t.status,
    'service_type', t.service_type,
    'city', t.city,
    'state', t.state,
    'created_at', t.created_at,
    'start_datetime', t.start_datetime,
    'end_datetime', t.end_datetime,
    'main_agent_arrival', t.main_agent_arrival,
    'main_agent_departure', t.main_agent_departure,
    'client_name', c.name,
    'vehicle_description', v.description,
    'vehicle_plate', v.tractor_plate,
    'main_agent_first_name', split_part(a.name, ' ', 1),
    'photos', (
      SELECT json_agg(json_build_object(
        'file_url', p.file_url,
        'caption', p.caption,
        'created_at', p.created_at
      ))
      FROM ticket_photos p
      WHERE p.ticket_id = t.id
    )
  ) INTO v_result
  FROM tickets t
  LEFT JOIN clients c ON t.client_id = c.id
  LEFT JOIN vehicles v ON t.vehicle_id = v.id
  LEFT JOIN agents a ON t.main_agent_id = a.id
  WHERE t.id = p_ticket_id;

  RETURN v_result;
END;
$$;