-- Tasks keep one shared execution status in Planner and Checklist.
ALTER TABLE public.event_tasks
  ADD COLUMN category text,
  ADD COLUMN budget_item_id uuid,
  ADD CONSTRAINT event_tasks_category_length CHECK (category IS NULL OR char_length(category) <= 120),
  ADD CONSTRAINT event_tasks_budget_item_unique UNIQUE (budget_item_id);

-- Composite reference prevents linking a task to another event's expense.
ALTER TABLE public.event_budget_items
  ADD CONSTRAINT event_budget_items_id_event_unique UNIQUE (id, event_id);

ALTER TABLE public.event_tasks
  ADD CONSTRAINT event_tasks_budget_same_event_fk
  FOREIGN KEY (budget_item_id, event_id)
  REFERENCES public.event_budget_items (id, event_id)
  ON DELETE SET NULL (budget_item_id);

COMMENT ON COLUMN public.event_tasks.category IS 'Categoria do checklist; NULL preserva tarefas antigas sem classificação';
COMMENT ON COLUMN public.event_tasks.budget_item_id IS 'Despesa de origem do mesmo evento, com no máximo uma tarefa por despesa';
