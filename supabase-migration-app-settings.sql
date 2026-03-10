-- Migration: app_settings table for admin-configurable workflow and planner
-- Applied via Supabase MCP (create_app_settings). Kept here as documentation/fallback.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select_authenticated"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings_admin_all"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Seed (run once; use ON CONFLICT DO NOTHING or skip if rows exist)
INSERT INTO public.app_settings (key, value) VALUES
  ('workflow_stages', '[
    {"value": "tarefas", "label": "Tarefas", "sortOrder": 0, "showInKanban": true},
    {"value": "revisao", "label": "Revisão", "sortOrder": 1, "showInKanban": true},
    {"value": "revisado", "label": "Revisado", "sortOrder": 2, "showInKanban": true},
    {"value": "revisao_autor", "label": "Revisão autor", "sortOrder": 3, "showInKanban": true},
    {"value": "concluido", "label": "Concluído", "sortOrder": 4, "showInKanban": false}
  ]'::jsonb),
  ('planner_tabs', '["kanban", "concluidos", "posts"]'::jsonb),
  ('completion_types', '[
    {"value": "design_concluido", "label": "Design concluído"},
    {"value": "postagem_feita", "label": "Postagem feita"},
    {"value": "conteudo_entregue", "label": "Conteúdo entregue"}
  ]'::jsonb),
  ('kanban_visibility', '"designer_own_admin_all"'::jsonb),
  ('stage_move_rules', '{"revisao": {"showArtLinkDialog": true, "keepAssignee": false}}'::jsonb)
ON CONFLICT (key) DO NOTHING;
