-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "originalAmount" INTEGER NOT NULL DEFAULT 0,
    "rate" REAL NOT NULL DEFAULT 1,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL,
    "nature" TEXT NOT NULL DEFAULT 'operating',
    "note" TEXT,
    "categoryId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "debtId" INTEGER,
    "debtPaymentId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_debtPaymentId_fkey" FOREIGN KEY ("debtPaymentId") REFERENCES "DebtPayment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "categoryId", "createdAt", "currency", "date", "debtId", "debtPaymentId", "id", "kind", "nature", "note", "originalAmount", "projectId", "rate") SELECT "amount", "categoryId", "createdAt", "currency", "date", "debtId", "debtPaymentId", "id", "kind", "nature", "note", "originalAmount", "projectId", "rate" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_debtId_key" ON "Transaction"("debtId");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE INDEX "Transaction_projectId_idx" ON "Transaction"("projectId");
CREATE INDEX "Transaction_nature_idx" ON "Transaction"("nature");
CREATE INDEX "Transaction_debtPaymentId_idx" ON "Transaction"("debtPaymentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
