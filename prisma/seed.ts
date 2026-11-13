import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const CATEGORIES: Record<string, string[]> = {
  "Employee Fraud": [
    "Mis-selling",
    "Loan without consent",
    "Bribery",
    "Fradulent Fund Transfer - siphoning of loan funds",
    "Fradulent Fund Transfer from Merchant account",
    "Mediclaim Fraud",
    "Identity Concealment",
    "Ghost Employee",
    "Reimbursement Fraud",
    "DLP Issue - Data Leakage/ Sharing confidential information to self or external parties",
    "Others",
  ],
  "Employee Mis-conduct": [
    "Funds taken from Merchant - with Consent",
    "COC Violation - Dual Employment",
    "COC Violation - Undisclosed Business Interests",
    "COC Violation - Undisclosed Relationships (Friends, Family, Romantic, Supplier)",
    "Gross violation/Negligence",
    "Others",
  ],
  "Employee Concerns": [
    "PIP Related Allegation",
    "Salary/F&F Related Issue",
    "Decorum - Physical Abuse",
    "Decorum - Verbal Abuse & Unprofessional Conduct",
    "Decorum - Unprofessional Conduct",
    "Toxic Work Enviromnent",
    "Harrasment",
    "Others",
  ],
};

async function main() {
  // Lookups
  for (const [cat, subs] of Object.entries(CATEGORIES)) {
    const c = await db.lookupCategory.upsert({
      where: { name: cat },
      create: { name: cat },
      update: {},
    });
    for (const sub of subs) {
      await db.lookupSubCategory.upsert({
        where: { categoryId_name: { categoryId: c.id, name: sub } },
        create: { name: sub, categoryId: c.id },
        update: {},
      });
    }
  }

  // Users
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const testUser = await db.user.upsert({
    where: { email: "test@gmail.com" },
    create: {
      email: "test@gmail.com",
      name: "Test User",
      passwordHash: hash("password"),
      role: "ADMIN",
      roles: "ADMIN,REVIEWER_L2",
      employeeCode: "TEST001",
      entity: "OCL",
    },
    update: {},
  });

  // App settings
  await db.appSetting.upsert({
    where: { key: "sla_days_default" },
    create: { key: "sla_days_default", value: "30" },
    update: {},
  });

  // test@gmail.com is the only login; remove every other user and hand their records to it
  const legacyUsers = await db.user.findMany({ where: { id: { not: testUser.id } }, select: { id: true } });
  const legacyIds = legacyUsers.map((u) => u.id);
  if (legacyIds.length) {
    const ids = { in: legacyIds };
    await db.case.updateMany({ where: { assigneeId: ids }, data: { assigneeId: null } });
    await db.case.updateMany({ where: { l1ReviewerId: ids }, data: { l1ReviewerId: null } });
    await db.case.updateMany({ where: { l2ReviewerId: ids }, data: { l2ReviewerId: null } });
    await db.case.updateMany({ where: { createdById: ids }, data: { createdById: testUser.id } });
    await db.caseAttachment.updateMany({ where: { uploadedById: ids }, data: { uploadedById: testUser.id } });
    await db.auditLog.updateMany({ where: { userId: ids }, data: { userId: testUser.id } });
    await db.employeeUploadLog.updateMany({ where: { uploadedById: ids }, data: { uploadedById: testUser.id } });
    await db.user.updateMany({ where: { createdById: ids }, data: { createdById: null } });
    await db.passwordResetRequest.updateMany({ where: { resolvedById: ids }, data: { resolvedById: null } });
    await db.userRequest.updateMany({ where: { reviewedById: ids }, data: { reviewedById: null } });
    await db.user.deleteMany({ where: { id: ids } });
  }

  console.log("✅ Seed complete.");
  console.log("   Test User (Admin): test@gmail.com / password");
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
