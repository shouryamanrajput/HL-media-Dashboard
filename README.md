# HL Media — Project Studio

Internal project and task management for HL Media's video editing and production work. Clients never log in; each project records which client it is for.

## Quick start

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET
npm run db:reset            # creates prisma/prisma/dev.db and seeds demo data
npm run dev
```

Open http://localhost:3000 and sign in.

| Email | Password | Role |
| --- | --- | --- |
| test@gmail.com | password | Admin + Reviewer |
| editor@gmail.com | password | Editor |
| reviewer@gmail.com | password | Reviewer |

## What's inside

- **Projects** (`HLM-0001`…): client, type, priority, due date, editor and reviewer. Stages run Brief → Pre-production → Footage Received → Editing → Internal Review → Revisions → Final Export → Delivered, plus On Hold and Cancelled.
- **Board**: Kanban view; drag a card to change its stage.
- **Tasks**: per-project to-dos with assignee, estimate and logged hours. **My Tasks** lists yours.
- **Internal review**: editors submit a cut to a reviewer, who approves it or requests changes (this increments the revision count).
- **Files & links**: upload drafts and finals (up to 50 MB, local disk or S3) or paste Frame.io, Drive or Dropbox links. Drafts and finals are versioned.
- **Deliverables**: each export with platform, aspect ratio, length and status.
- **Clients, Team, Dashboards** (overview, workload, deadlines/turnaround, custom analytics), **Excel import** with a downloadable template, and an **audit log**.

## Roles

- **Admin**: everything, including users, access requests, project types and imports.
- **Editor**: sees projects they edit or have tasks on, and can update them.
- **Reviewer**: sees all projects and works the review queue.

## Scripts

- `npm run db:reset`: wipe and reseed the database.
- `npm run cron:overdue`: recompute deadlines and email editors about newly overdue projects (run daily).

## Configuration

See `.env.example`. Email is logged to the console unless `SMTP_HOST` is set. Google sign-in stays hidden until the Firebase variables are filled in. Set `S3_BUCKET` to store uploads in S3 instead of `./uploads`.
