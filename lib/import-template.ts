export const IMPORT_COLUMNS = [
  { header: "Project No", key: "projectNo", hint: "Optional. HLM-0012 or 12 updates that project; blank creates a new one." },
  { header: "Title", key: "title", hint: "Required." },
  { header: "Client", key: "client", hint: "Required. Created automatically if new." },
  { header: "Project Type", key: "projectType", hint: "Created automatically if new." },
  { header: "Brief", key: "brief", hint: "" },
  { header: "Source", key: "source", hint: "How the work came in." },
  { header: "Priority", key: "priority", hint: "LOW, MEDIUM, HIGH or URGENT." },
  { header: "Stage", key: "stage", hint: "See the Reference sheet." },
  { header: "Editor Email", key: "editorEmail", hint: "Must match an existing user." },
  { header: "Reviewer Email", key: "reviewerEmail", hint: "Must match an existing user." },
  { header: "Received Date", key: "receivedDate", hint: "YYYY-MM-DD" },
  { header: "Start Date", key: "startDate", hint: "YYYY-MM-DD" },
  { header: "Due Date", key: "dueDate", hint: "YYYY-MM-DD" },
  { header: "Delivered Date", key: "deliveredAt", hint: "YYYY-MM-DD" },
  { header: "Revision Count", key: "revisionCount", hint: "Number" },
  { header: "Final Link", key: "finalLink", hint: "URL of the delivered video." },
] as const;

export type ImportKey = (typeof IMPORT_COLUMNS)[number]["key"];
