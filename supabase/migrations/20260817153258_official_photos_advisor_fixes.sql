CREATE INDEX collaborator_photo_usages_photo_owner_idx
  ON public.collaborator_photo_usages(photo_id, user_id);

CREATE POLICY "service role manages official photo consumers"
  ON public.official_photo_api_consumers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service role manages official photo links"
  ON public.official_photo_system_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service role writes official photo audit"
  ON public.official_photo_api_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service role manages official photo quota"
  ON public.official_photo_api_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
