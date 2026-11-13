import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeDeadline } from "../lib/deadlines";

const db = new PrismaClient();
const DAY = 86400000;
const ago = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (d: number) => new Date(Date.now() + d * DAY);

async function main() {
  // Wipe in dependency order so the seed can be re-run.
  await db.comment.deleteMany();
  await db.auditLog.deleteMany();
  await db.projectAsset.deleteMany();
  await db.deliverable.deleteMany();
  await db.task.deleteMany();
  await db.project.deleteMany();
  await db.client.deleteMany();
  await db.projectType.deleteMany();
  await db.passwordResetRequest.deleteMany();
  await db.userRequest.deleteMany();
  await db.user.deleteMany();

  const passwordHash = bcrypt.hashSync("password", 10);
  const admin = await db.user.create({
    data: { email: "test@gmail.com", name: "Test User", passwordHash, role: "ADMIN", roles: "ADMIN,REVIEWER", title: "Studio Lead", department: "Management", skills: "Direction,Editing,Color", capacityHours: 30 },
  });
  const editor = await db.user.create({
    data: { email: "editor@gmail.com", name: "Riya Editor", passwordHash, role: "EDITOR", roles: "EDITOR", title: "Senior Editor", department: "Post-production", skills: "Premiere Pro,After Effects,Sound", capacityHours: 40 },
  });
  const reviewer = await db.user.create({
    data: { email: "reviewer@gmail.com", name: "Arjun Reviewer", passwordHash, role: "REVIEWER", roles: "REVIEWER", title: "Creative Producer", department: "Production", skills: "Storyboarding,Review,Color", capacityHours: 35 },
  });

  const typeNames = ["Promo / Ad", "Social Reel", "YouTube Video", "Corporate Film", "Interview", "Wedding", "Music Video", "Event Coverage"];
  const types = Object.fromEntries(await Promise.all(typeNames.map(async (name) => [name, (await db.projectType.create({ data: { name } })).id])));

  const clientRows = [
    { name: "Acme Foods", contactName: "Neha Kapoor", email: "neha@acmefoods.example", phone: "+91 98100 00001", notes: "Monthly retainer — 8 reels." },
    { name: "Northwind Studio", contactName: "Karan Mehta", email: "karan@northwind.example", phone: "+91 98100 00002" },
    { name: "Bluebird Fitness", contactName: "Sara Thomas", email: "sara@bluebird.example", notes: "Prefers 4:5 for Instagram." },
    { name: "Rao Family", contactName: "Vikram Rao", phone: "+91 98100 00004", notes: "Wedding, Dec 2026." },
  ];
  const clients = Object.fromEntries(await Promise.all(clientRows.map(async (c) => [c.name, (await db.client.create({ data: c })).id])));

  type Seed = {
    title: string; client: string; type: string; stage: string; priority: string; source: string;
    received: number; due: number | null; delivered?: number; started?: number;
    editor?: string | null; reviewer?: string | null; revisions?: number; overdueReason?: string;
    tasks: [string, string, number, number, number | null][]; // title, status, estimate, logged, due offset
    deliverables?: [string, string, string, number, string][]; // name, platform, ratio, seconds, status
    assets?: [string, string, string][]; // kind, label, url
    comments?: string[];
  };

  const E = editor.id, R = reviewer.id, A = admin.id;
  const seeds: Seed[] = [
    { title: "Spring Range Launch Teaser", client: "Acme Foods", type: "Promo / Ad", stage: "EDITING", priority: "HIGH", source: "Repeat client", received: 6, due: 4, started: 2, editor: E, reviewer: R,
      tasks: [["Assemble rough cut", "DONE", 6, 6.5, -1], ["Music licensing", "IN_PROGRESS", 1, 0.5, 1], ["Colour grade", "TODO", 4, 0, 3]],
      deliverables: [["30s Master", "YouTube", "16:9", 30, "IN_PROGRESS"], ["15s Reel", "Instagram", "9:16", 15, "PENDING"], ["6s Bumper", "YouTube", "16:9", 6, "PENDING"]],
      assets: [["RAW", "Shoot day footage", "https://drive.google.com/drive/folders/acme-raw"], ["REFERENCE", "Mood board", "https://www.pinterest.com/acme-moodboard"]],
      comments: ["Client wants the product hero shot in the first 3 seconds."] },
    { title: "Founder Story Interview", client: "Northwind Studio", type: "Interview", stage: "INTERNAL_REVIEW", priority: "MEDIUM", source: "Website", received: 12, due: 2, started: 8, editor: E, reviewer: R,
      tasks: [["Sync multicam", "DONE", 2, 2, -6], ["First cut", "DONE", 8, 9, -2], ["Lower thirds", "IN_REVIEW", 2, 2, 0]],
      deliverables: [["8 min Edit", "YouTube", "16:9", 480, "READY"]],
      assets: [["DRAFT", "Cut v1", "https://frame.io/northwind-v1"]], comments: ["v1 is up on Frame.io for review."] },
    { title: "January Workout Reels (x6)", client: "Bluebird Fitness", type: "Social Reel", stage: "REVISIONS", priority: "HIGH", source: "Instagram", received: 15, due: -2, started: 12, editor: E, reviewer: R, revisions: 2,
      overdueReason: "Waiting on replacement clips from the client.",
      tasks: [["Edit reels 1–3", "DONE", 6, 7, -8], ["Edit reels 4–6", "IN_PROGRESS", 6, 3, -2], ["Apply review notes", "TODO", 2, 0, 1]],
      deliverables: [["Reel 1–6", "Instagram", "4:5", 30, "IN_PROGRESS"]], comments: ["Captions too small on reel 2 — bump to 48pt."] },
    { title: "Annual Conference Highlights", client: "Northwind Studio", type: "Event Coverage", stage: "FOOTAGE_RECEIVED", priority: "MEDIUM", source: "Repeat client", received: 3, due: 9, editor: E, reviewer: null,
      tasks: [["Log and select footage", "IN_PROGRESS", 4, 1, 2]], assets: [["RAW", "Cam A + Cam B", "https://dropbox.com/northwind-conf"]] },
    { title: "Wedding Highlight Film", client: "Rao Family", type: "Wedding", stage: "PRE_PRODUCTION", priority: "URGENT", source: "Referral", received: 2, due: 25, editor: A, reviewer: R,
      tasks: [["Shot list with family", "IN_PROGRESS", 2, 1, 3], ["Book second shooter", "TODO", 0.5, 0, 5]] },
    { title: "Kitchen Tips YouTube Series Ep 4", client: "Acme Foods", type: "YouTube Video", stage: "BRIEF", priority: "LOW", source: "Repeat client", received: 1, due: 14, editor: null, reviewer: null, tasks: [] },
    { title: "Gym Brand Film", client: "Bluebird Fitness", type: "Corporate Film", stage: "FINAL_EXPORT", priority: "MEDIUM", source: "Referral", received: 20, due: 1, started: 15, editor: E, reviewer: R, revisions: 1,
      tasks: [["Final mix", "DONE", 2, 2, -1], ["Export masters", "IN_PROGRESS", 1, 0, 1]],
      deliverables: [["2 min Film", "Website", "16:9", 120, "READY"], ["60s Cutdown", "Instagram", "9:16", 60, "IN_PROGRESS"]] },
    { title: "Festive Offer Ad", client: "Acme Foods", type: "Promo / Ad", stage: "DELIVERED", priority: "HIGH", source: "Repeat client", received: 40, due: 30, started: 37, delivered: 31, editor: E, reviewer: R, revisions: 1,
      tasks: [["Edit", "DONE", 6, 6, -33], ["Grade", "DONE", 3, 3, -32]], deliverables: [["20s Ad", "YouTube", "16:9", 20, "DELIVERED"]],
      assets: [["FINAL", "Final master", "https://drive.google.com/acme-festive-final"]] },
    { title: "Product Demo Video", client: "Northwind Studio", type: "YouTube Video", stage: "DELIVERED", priority: "MEDIUM", source: "Website", received: 70, due: 55, started: 65, delivered: 52, editor: A, reviewer: R,
      tasks: [["Screen recordings", "DONE", 3, 4, -60], ["Edit", "DONE", 8, 10, -54]] },
    { title: "Summer Challenge Reels", client: "Bluebird Fitness", type: "Social Reel", stage: "DELIVERED", priority: "LOW", source: "Instagram", received: 95, due: 80, started: 90, delivered: 82, editor: E, reviewer: R, revisions: 2, tasks: [] },
    { title: "Music Video Concept", client: "Northwind Studio", type: "Music Video", stage: "ON_HOLD", priority: "LOW", source: "Referral", received: 30, due: -5, editor: E, reviewer: null, overdueReason: "Artist rescheduled the shoot.", tasks: [] },
  ];

  for (const [i, s] of seeds.entries()) {
    const receivedDate = ago(s.received);
    const dueDate = s.due == null ? null : ahead(s.due);
    const deliveredAt = s.delivered != null ? ago(s.delivered) : null;
    const p = await db.project.create({
      data: {
        projectNo: i + 1,
        title: s.title,
        brief: `${s.type} for ${s.client}.`,
        clientId: clients[s.client],
        projectTypeId: types[s.type],
        source: s.source,
        priority: s.priority,
        stage: s.stage,
        editorId: s.editor ?? null,
        reviewerId: s.reviewer ?? null,
        receivedDate,
        startDate: s.started != null ? ago(s.started) : null,
        dueDate,
        deliveredAt,
        revisionCount: s.revisions ?? 0,
        overdueReason: s.overdueReason ?? null,
        submittedForReviewAt: s.stage === "INTERNAL_REVIEW" ? ago(1) : null,
        reviewStatus: s.stage === "REVISIONS" ? "CHANGES_REQUESTED" : s.stage === "FINAL_EXPORT" || s.stage === "DELIVERED" ? "APPROVED" : null,
        reviewComments: s.stage === "REVISIONS" ? "Tighten pacing in reels 4–6; captions need to be larger." : null,
        finalLink: s.stage === "DELIVERED" ? "https://drive.google.com/hl-media-final" : null,
        createdById: A,
        ...computeDeadline({ receivedDate, dueDate, deliveredAt, stage: s.stage }),
        tasks: {
          create: s.tasks.map(([title, status, est, logged, due]) => ({
            title, status, estimateHours: est, loggedHours: logged,
            dueDate: due == null ? null : ahead(due),
            completedAt: status === "DONE" ? ago(1) : null,
            assigneeId: s.editor ?? E, createdById: A,
          })),
        },
        deliverables: { create: (s.deliverables ?? []).map(([name, platform, aspectRatio, durationSec, status]) => ({ name, platform, aspectRatio, durationSec, status })) },
        assets: {
          create: (s.assets ?? []).map(([kind, label, url]) => ({ kind, label, url, version: kind === "DRAFT" || kind === "FINAL" ? 1 : null, uploadedById: s.editor ?? A })),
        },
        comments: { create: (s.comments ?? []).map((body) => ({ body, userId: s.reviewer ?? A })) },
      },
    });
    await db.auditLog.create({ data: { projectId: p.id, entity: "Project", entityId: p.id, action: "CREATE", diff: JSON.stringify({ title: { before: null, after: p.title } }), userId: A } });
  }

  console.log(`Seeded 3 users (password "password"), ${typeNames.length} project types, ${clientRows.length} clients, ${seeds.length} projects.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
