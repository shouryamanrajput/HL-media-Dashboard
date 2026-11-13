import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { IMPORT_COLUMNS } from "@/lib/import-template";
import { PRIORITY_LIST, STAGE_LIST, STAGE_LABELS } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const [users, types, clients] = await Promise.all([
    db.user.findMany({ where: { active: true }, select: { email: true, name: true }, orderBy: { name: "asc" } }),
    db.projectType.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    db.client.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const editor = users[0]?.email ?? "test@gmail.com";
  const today = new Date();
  const iso = (offset: number) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10);

  const samples = [
    ["", "Spring Launch Teaser", "Acme Foods", "Promo / Ad", "30s teaser for the new range, 3 cutdowns.", "Email", "HIGH", "Editing", editor, editor, iso(-5), iso(-3), iso(4), "", 0, ""],
    ["", "Founder Interview", "Northwind Studio", "Interview", "Two-camera interview, 8 min edit with lower thirds.", "WhatsApp", "MEDIUM", "Footage Received", editor, "", iso(-2), "", iso(10), "", 0, ""],
    ["", "Wedding Highlights", "Rao Family", "Wedding", "5 min highlight film plus 60s reel.", "Referral", "URGENT", "Delivered", editor, editor, iso(-20), iso(-18), iso(-6), iso(-7), 1, "https://drive.google.com/example"],
  ];

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS.map((c) => c.header), ...samples]);
  sheet["!cols"] = IMPORT_COLUMNS.map((c) => ({ wch: Math.max(14, c.header.length + 4) }));
  XLSX.utils.book_append_sheet(wb, sheet, "Projects");

  const longest = Math.max(PRIORITY_LIST.length, STAGE_LIST.length, users.length, types.length, clients.length, IMPORT_COLUMNS.length);
  const ref: (string | undefined)[][] = [["Column", "Notes", "", "Priority", "Stage", "Team emails", "Project types", "Clients"]];
  for (let i = 0; i < longest; i++) {
    ref.push([
      IMPORT_COLUMNS[i]?.header, IMPORT_COLUMNS[i]?.hint, "",
      PRIORITY_LIST[i], STAGE_LIST[i] ? STAGE_LABELS[STAGE_LIST[i]] : undefined,
      users[i] ? `${users[i].email} (${users[i].name})` : undefined, types[i]?.name, clients[i]?.name,
    ]);
  }
  const refSheet = XLSX.utils.aoa_to_sheet(ref);
  refSheet["!cols"] = [{ wch: 16 }, { wch: 55 }, { wch: 2 }, { wch: 10 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, refSheet, "Reference");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="HLMedia_Import_Template.xlsx"',
    },
  });
}
