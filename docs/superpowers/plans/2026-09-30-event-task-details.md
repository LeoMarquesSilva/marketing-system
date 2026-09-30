# Event task details implementation plan

> **For agentic workers:** execute this approved plan inline. Use the existing event components and CRUD functions.

**Goal:** provide an editable task list with visible details and organized menu tasting tasks.

**Architecture:** reuse event_tasks without schema changes. Separate list filtering from the task editor; return persistence outcomes from the parent handlers so the editor stays open on failure.

**Tech Stack:** Next.js, React, TypeScript, existing Radix UI components, Supabase and Vitest.

## Global constraints

- Preserve unrelated changes and existing task assignments, dates and completion state.
- No invitations, outgoing messages, new expenses or assumed supplier approval.
- Store the tasting schedule and menu as plain text in the existing description.
- No direct publication to main without explicit authorization.

## Implementation

- [x] Register the tasting supplier, the first tasting, the menu reference, menu evaluation and drinks selection in the existing database. Verify the records and original image bytes. Keep all business records and attendee data in the event, outside Git.
- [x] Add pure task filtering/grouping helpers with tests covering text inside descriptions, unassigned tasks and overdue completed tasks.
- [x] Add a task editor for existing title, description, assignee, due date, status and phase fields. Retain draft on failed persistence and confirm deletion.
- [x] Replace the table with expandable task rows, progress, search and filters; keep quick creation and Planner links.
- [x] Integrate create/update handlers returning boolean results and busy feedback.
- [x] Run focused Vitest, ESLint and TypeScript checks, inspect browser layout and persistence behavior, and prepare the changes for review/publication.

Validation: four focused Vitest tests passed; ESLint and TypeScript passed; production build completed. Browser preview verified expand/collapse, editing, successful save, retained draft on failed save and participant search. List and editor inspected at desktop width and 390px mobile width. Preview uses in-memory handlers, so production task state is unchanged by UI checks.
