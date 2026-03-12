-- CreateEnum
CREATE TYPE "PreferenceInputType" AS ENUM ('SINGLE_SELECT', 'MULTI_SELECT', 'HIERARCHICAL_MULTI', 'SLIDER');

-- DropIndex
DROP INDEX "response_snapshots_userId_current_unique";

-- AlterTable
ALTER TABLE "answer_options" ALTER COLUMN "order" DROP DEFAULT;

-- CreateTable
CREATE TABLE "preference_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "inputType" "PreferenceInputType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "topicId" TEXT,

    CONSTRAINT "preference_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_options" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "isAutoSelected" BOOLEAN NOT NULL DEFAULT false,
    "requiresChild" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "preference_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_sliders" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minValue" INTEGER NOT NULL DEFAULT 0,
    "maxValue" INTEGER NOT NULL DEFAULT 10,
    "defaultValue" INTEGER NOT NULL DEFAULT 5,
    "step" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,

    CONSTRAINT "preference_sliders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preference_selections" (
    "id" TEXT NOT NULL,
    "userPreferenceId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "user_preference_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preference_slider_values" (
    "id" TEXT NOT NULL,
    "userPreferenceId" TEXT NOT NULL,
    "sliderId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "user_preference_slider_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preference_categories_slug_key" ON "preference_categories"("slug");

-- CreateIndex
CREATE INDEX "preference_categories_order_idx" ON "preference_categories"("order");

-- CreateIndex
CREATE INDEX "preference_options_categoryId_idx" ON "preference_options"("categoryId");

-- CreateIndex
CREATE INDEX "preference_options_parentId_idx" ON "preference_options"("parentId");

-- CreateIndex
CREATE INDEX "preference_sliders_categoryId_idx" ON "preference_sliders"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_preference_selections_optionId_idx" ON "user_preference_selections"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_selections_userPreferenceId_optionId_key" ON "user_preference_selections"("userPreferenceId", "optionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_slider_values_userPreferenceId_sliderId_key" ON "user_preference_slider_values"("userPreferenceId", "sliderId");

-- AddForeignKey
ALTER TABLE "preference_categories" ADD CONSTRAINT "preference_categories_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_options" ADD CONSTRAINT "preference_options_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "preference_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_options" ADD CONSTRAINT "preference_options_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "preference_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_sliders" ADD CONSTRAINT "preference_sliders_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "preference_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference_selections" ADD CONSTRAINT "user_preference_selections_userPreferenceId_fkey" FOREIGN KEY ("userPreferenceId") REFERENCES "user_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference_selections" ADD CONSTRAINT "user_preference_selections_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "preference_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference_slider_values" ADD CONSTRAINT "user_preference_slider_values_userPreferenceId_fkey" FOREIGN KEY ("userPreferenceId") REFERENCES "user_preferences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference_slider_values" ADD CONSTRAINT "user_preference_slider_values_sliderId_fkey" FOREIGN KEY ("sliderId") REFERENCES "preference_sliders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
