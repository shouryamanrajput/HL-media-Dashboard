import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/rbac";
import { IMPORT_COLUMNS } from "@/lib/import-template";
import { importExcel } from "./actions";
import { Icon } from "@/components/icon";
import { SubmitButton } from "./submit-button";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; n?: string; u?: string; warn?: string; err?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!can(session.user, "project:import")) {
    return <div className="card p-6">You don&apos;t have permission to import.</div>;
  }
  const sp = await searchParams;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">Bulk Import from Excel</h1>
        <p className="page-sub">Upload a project tracker (.xlsx). The first sheet is read and columns are matched by header name.</p>
      </div>

      {sp.ok && <div className="card p-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-400 text-sm">Created {sp.n ?? 0} and updated {sp.u ?? 0} projects.</div>}
      {sp.warn && <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-800 dark:text-amber-400 text-sm">Warnings: {sp.warn}</div>}
      {sp.err && <div className="card p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-400 text-sm">Import failed: {sp.err}</div>}

      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 grid place-items-center shrink-0">
            <Icon name="file" className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-900 dark:text-white">Sample Template</div>
            <p className="text-xs text-ink-500 dark:text-gray-500 mt-0.5">
              Download the Excel template with every header and sample rows. A &quot;Reference&quot; sheet lists allowed priorities, stages and team emails.
            </p>
            <a href="/api/sample-template" download="HLMedia_Import_Template.xlsx" className="btn-secondary mt-3 inline-flex text-xs">
              <Icon name="arrow-left" className="h-3.5 w-3.5 -rotate-90" />
              Download Template
            </a>
          </div>
        </div>
      </div>

      <form action={importExcel} className="card p-5 space-y-4">
        <div className="text-sm font-semibold text-ink-900 dark:text-white">Upload Projects</div>
        <div>
          <label className="label">Excel file (.xlsx)</label>
          <input type="file" name="file" accept=".xlsx,.xls" required className="input" />
        </div>
        <p className="text-xs text-ink-400 dark:text-gray-500">
          Recognised headers: {IMPORT_COLUMNS.map((c) => c.header).join(", ")}. Title and Client are required.
        </p>
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </div>
  );
}
