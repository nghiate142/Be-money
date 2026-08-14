-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "currencyCode" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "rate" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExchangeRate_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

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
    "loanType" TEXT NOT NULL DEFAULT 'personal',
    "interestMethod" TEXT NOT NULL DEFAULT 'none',
    "interestRate" REAL,
    "fixedInterestAmount" INTEGER,
    "termMonths" INTEGER,
    "paymentDay" INTEGER,
    "interestNote" TEXT,
    "note" TEXT,
    "projectId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debt_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Debt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("createdAt", "date", "direction", "dueDate", "id", "interestNote", "note", "personId", "principal", "projectId") SELECT "createdAt", "date", "direction", "dueDate", "id", "interestNote", "note", "personId", "principal", "projectId" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE INDEX "Debt_personId_idx" ON "Debt"("personId");
CREATE INDEX "Debt_direction_idx" ON "Debt"("direction");
CREATE INDEX "Debt_dueDate_idx" ON "Debt"("dueDate");
CREATE INDEX "Debt_projectId_idx" ON "Debt"("projectId");
CREATE TABLE "new_Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "originalAmount" INTEGER NOT NULL DEFAULT 0,
    "rate" REAL NOT NULL DEFAULT 1,
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
INSERT INTO "new_Transaction" ("amount", "categoryId", "createdAt", "date", "debtId", "debtPaymentId", "id", "kind", "nature", "note", "projectId") SELECT "amount", "categoryId", "createdAt", "date", "debtId", "debtPaymentId", "id", "kind", "nature", "note", "projectId" FROM "Transaction";
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

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_currencyCode_date_key" ON "ExchangeRate"("currencyCode", "date");
