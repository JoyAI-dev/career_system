-- CreateTable
CREATE TABLE "login_attempts" (
    "username" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("username")
);
