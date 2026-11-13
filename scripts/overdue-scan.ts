// Recomputes deadline fields for open projects and emails editors about newly overdue work.
// Run daily, e.g. `npm run cron:overdue`.
import { PrismaClient } from "@prisma/client";
import { computeDeadline } from "../lib/deadlines";
import { notifyOverdue } from "../lib/notifications";

const db = new PrismaClient();

async function main() {
  const open = await db.project.findMany({ where: { stage: { notIn: ["DELIVERED", "CANCELLED"] } } });
  let newlyOverdue = 0;
  for (const p of open) {
    const d = computeDeadline({ receivedDate: p.receivedDate, dueDate: p.dueDate, deliveredAt: p.deliveredAt, stage: p.stage });
    await db.project.update({ where: { id: p.id }, data: d });
    if (d.isOverdue && !p.isOverdue) {
      newlyOverdue++;
      await notifyOverdue(p.id).catch((e) => console.error(`notify failed for ${p.id}`, e));
    }
  }
  console.log(`Scanned ${open.length} open projects; ${newlyOverdue} newly overdue.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
