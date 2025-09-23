-- CreateEnum
CREATE TYPE "review_type" AS ENUM ('GUEST_REVIEW', 'HOST_REVIEW');

-- CreateEnum
CREATE TYPE "channel" AS ENUM ('AIRBNB', 'VRBO', 'BOOKING_COM', 'GOOGLE', 'DIRECT');

-- CreateEnum
CREATE TYPE "category" AS ENUM ('CLEANLINESS', 'COMMUNICATION', 'CHECK_IN', 'ACCURACY', 'LOCATION', 'VALUE', 'OVERALL');

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "hostaway_listing_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "hostaway_review_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "review_type" "review_type" NOT NULL,
    "channel" "channel" NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "public_review" TEXT,
    "guest_name" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_categories" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "category" "category" NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "review_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listings_hostaway_listing_id_key" ON "listings"("hostaway_listing_id");

-- CreateIndex
CREATE UNIQUE INDEX "listings_slug_key" ON "listings"("slug");

-- CreateIndex
CREATE INDEX "listings_hostaway_listing_id_idx" ON "listings"("hostaway_listing_id");

-- CreateIndex
CREATE INDEX "listings_slug_idx" ON "listings"("slug");

-- CreateIndex
CREATE INDEX "listings_created_at_idx" ON "listings"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_hostaway_review_id_key" ON "reviews"("hostaway_review_id");

-- CreateIndex
CREATE INDEX "reviews_listing_id_idx" ON "reviews"("listing_id");

-- CreateIndex
CREATE INDEX "reviews_approved_idx" ON "reviews"("approved");

-- CreateIndex
CREATE INDEX "reviews_submitted_at_idx" ON "reviews"("submitted_at");

-- CreateIndex
CREATE INDEX "reviews_channel_idx" ON "reviews"("channel");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "reviews_review_type_idx" ON "reviews"("review_type");

-- CreateIndex
CREATE INDEX "reviews_hostaway_review_id_idx" ON "reviews"("hostaway_review_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_categories_review_id_category_key" ON "review_categories"("review_id", "category");

-- CreateIndex
CREATE INDEX "review_categories_review_id_idx" ON "review_categories"("review_id");

-- CreateIndex
CREATE INDEX "review_categories_category_idx" ON "review_categories"("category");

-- CreateIndex
CREATE INDEX "review_categories_rating_idx" ON "review_categories"("rating");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_categories" ADD CONSTRAINT "review_categories_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
