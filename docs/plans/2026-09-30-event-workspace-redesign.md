# Event workspace redesign

## Request and decisions

Keep the event Planner inside the selected event in the Events module. Remove the Events tab added to the general marketing Planner. Preserve event records and the existing marketing-request integration.

The audit found a ten-item overflowing navigation strip, repeated summary cards on every tab, a large task progress panel above the board, text-only assignees, raw status codes for guests, and creation forms competing with existing records.

Use the current ORQESTRAI typography, color tokens, Radix primitives, and avatar component. No new dependency or database migration. Event header exposes date, place, expected attendance, and the actual owner/task assignees. Primary sections stay visible; secondary operations live under More. URL parameters select sections and can open a specific task. Overview highlights upcoming work, team, documents, and finances. Board/list/calendar stay inside the event. Filters and entry forms are disclosed on demand. Attachment cards preview actual image files; photo albums come from the existing authenticated photo API and match explicit eventId only.

## Research

- [Asana project views](https://asana.com/features/project-management/project-views): multiple views of the same project work.
- [Atlassian avatar groups](https://atlassian.design/components/avatar-group/): represent real people using the existing identity data.
- [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): keep frequent actions visible and defer secondary controls.
- [NN/g tabs](https://www.nngroup.com/articles/tabs-used-right/): avoid excessive layers and clarify current location.

UI/UX Pro Max and Redesign Existing Projects were consulted. Automated design-system suggestions were adapted to an existing internal productivity app; the generated conference-landing palette and marketing layout were not adopted.

## Data and permissions

No event-data mutations during verification. No personal data, photos, proposal, or contract contents are included in source fixtures or this document. Avatars resolve by user ID; guest photos resolve only for collaborator records with an exact email match. Albums are filtered by eventId, never by similar titles. The photo library link follows module access and the API retains its publication/manager checks. File labels describe inclusion in the share link, without implying the storage bucket is private.

## Verification

- Scoped ESLint and production build (including TypeScript).
- Existing suite: 1,174 passed on the first run; one administrative test timed out under concurrent build load. Its file passed when rerun independently (both tests). One external AI test remains skipped.
- Browser preview uses real UI components and synthetic records with in-memory mutations: status change using menu/keyboard, creation within a chosen column, assignee filter, October calendar, direct opening from the overview, and retained editor draft on simulated save failure.
- Responsive inspection at 390px found a compressed search field; the toolbar now gives search its own row on mobile.
- Production verification is read-only after deployment.
