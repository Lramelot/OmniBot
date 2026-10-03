-- CreateTable
CREATE TABLE "Birthday" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastCelebratedYear" INTEGER,
    "grantedRoleId" TEXT,

    CONSTRAINT "Birthday_pkey" PRIMARY KEY ("guildId","userId")
);
