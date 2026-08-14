-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Debt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "affectsBalance" BOOLEAN NOT NULL DEFAULT true,
    "loanType" TEXT NOT NULL DEFAULT 'personal',
    "interestMethod" TEXT NOT NULL DEFAULT 'none',
    "interestRate" REAL,
    "fixedInterestAmount" INTEGER,
    "contractPayment" INTEGER,
    "contractLastPayment" INTEGER,
    "termMonths" INTEGER,
    "paymentDay" INTEGER,
    "interestNote" TEXT,
    "note" TEXT,
    "projectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debt_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Debt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("contractLastPayment", "contractPayment", "createdAt", "date", "direction", "dueDate", "fixedInterestAmount", "id", "interestMethod", "interestNote", "interestRate", "loanType", "note", "paymentDay", "personId", "principal", "projectId", "termMonths") SELECT "contractLastPayment", "contractPayment", "createdAt", "date", "direction", "dueDate", "fixedInterestAmount", "id", "interestMethod", "interestNote", "interestRate", "loanType", "note", "paymentDay", "personId", "principal", "projectId", "termMonths" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE INDEX "Debt_personId_idx" ON "Debt"("personId");
CREATE INDEX "Debt_direction_idx" ON "Debt"("direction");
CREATE INDEX "Debt_dueDate_idx" ON "Debt"("dueDate");
CREATE INDEX "Debt_projectId_idx" ON "Debt"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
