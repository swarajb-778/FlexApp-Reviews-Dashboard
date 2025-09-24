import { PrismaClient, Channel, Category, ReviewType } from '@prisma/client';

const prisma = new PrismaClient();

const sampleListings = [
  {
    hostawayListingId: '1234',
    name: '2B N1 A - 29 Shoreditch Heights',
    slug: '2b-n1-a-29-shoreditch-heights',
  },
  {
    hostawayListingId: 'hostaway_12346',
    name: 'Modern Studio in Camden',
    slug: 'modern-studio-in-camden',
  },
  {
    hostawayListingId: 'hostaway_12347',
    name: 'Luxury Apartment in Canary Wharf',
    slug: 'luxury-apartment-in-canary-wharf',
  },
];

const sampleReviews = [
  {
    hostawayReviewId: '7453',
    reviewType: ReviewType.GUEST_REVIEW,
    channel: Channel.AIRBNB,
    rating: 4.8,
    publicReview: 'Amazing stay! The apartment was exactly as described, very clean and modern. The location is perfect with great transport links. Host was very responsive and helpful throughout. Would definitely recommend!',
    guestName: 'Sarah M.',
    submittedAt: new Date('2024-01-15T10:30:00Z'),
    approved: true,
    rawJson: {
      platform: 'airbnb',
      reviewId: 'airbnb_rev_001',
      guestProfile: {
        verified: true,
        reviewCount: 12,
      },
      amenityRatings: {
        cleanliness: 5,
        communication: 5,
        checkin: 4,
        accuracy: 5,
        location: 5,
        value: 4,
      },
    },
    categories: [
      { category: Category.CLEANLINESS, rating: 5.0 },
      { category: Category.COMMUNICATION, rating: 5.0 },
      { category: Category.CHECK_IN, rating: 4.0 },
      { category: Category.ACCURACY, rating: 5.0 },
      { category: Category.LOCATION, rating: 5.0 },
      { category: Category.VALUE, rating: 4.0 },
      { category: Category.OVERALL, rating: 4.8 },
    ],
  },
  // Edge case: missing rating but categories present (will compute)
  {
    hostawayReviewId: '7454',
    reviewType: ReviewType.GUEST_REVIEW,
    channel: Channel.AIRBNB,
    publicReview: 'Great place, rating missing but categories present.',
    guestName: 'Edge Case Missing Rating',
    submittedAt: new Date('2021-02-03T08:15:00Z'),
    approved: true,
    rawJson: { platform: 'airbnb', reviewId: 'airbnb_rev_7454' },
    categories: [
      { category: Category.CLEANLINESS, rating: 8.0 },
      { category: Category.COMMUNICATION, rating: 9.0 },
    ],
  },
  // Edge case: empty categories but has direct rating
  {
    hostawayReviewId: '7455',
    reviewType: ReviewType.GUEST_REVIEW,
    channel: Channel.BOOKING_COM,
    rating: 7.5,
    publicReview: 'Had a decent stay. No categories provided.',
    guestName: 'Empty Categories',
    submittedAt: new Date('2021-03-05T19:30:00Z'),
    approved: true,
    rawJson: { platform: 'booking.com', reviewId: 'booking_rev_7455' },
    categories: [],
  },
  {
    hostawayReviewId: 'review_002',
    reviewType: ReviewType.GUEST_REVIEW,
    channel: Channel.BOOKING_COM,
    rating: 4.2,
    publicReview: 'Good apartment with nice amenities. The check-in process was a bit confusing but the host helped resolve it quickly. Great location for exploring the city.',
    guestName: 'James T.',
    submittedAt: new Date('2024-01-20T14:15:00Z'),
    approved: true,
    rawJson: {
      platform: 'booking.com',
      reviewId: 'booking_rev_002',
      guestProfile: {
        verified: true,
        reviewCount: 8,
      },
    },
    categories: [
      { category: Category.CLEANLINESS, rating: 4.5 },
      { category: Category.COMMUNICATION, rating: 4.0 },
      { category: Category.CHECK_IN, rating: 3.5 },
      { category: Category.ACCURACY, rating: 4.0 },
      { category: Category.LOCATION, rating: 5.0 },
      { category: Category.VALUE, rating: 4.0 },
      { category: Category.OVERALL, rating: 4.2 },
    ],
  },
  {
    hostawayReviewId: 'review_003',
    reviewType: ReviewType.GUEST_REVIEW,
    channel: Channel.VRBO,
    rating: 3.8,
    publicReview: 'The apartment is nice but had some issues with WiFi during our stay. The host was apologetic and offered compensation. Overall decent experience.',
    guestName: 'Lisa K.',
    submittedAt: new Date('2024-01-25T09:45:00Z'),
    approved: false, // Pending approval due to WiFi complaint
    rawJson: {
      platform: 'vrbo',
      reviewId: 'vrbo_rev_003',
      guestProfile: {
        verified: true,
        reviewCount: 15,
      },
      issues: ['wifi_connectivity'],
    },
    categories: [
      { category: Category.CLEANLINESS, rating: 4.0 },
      { category: Category.COMMUNICATION, rating: 4.5 },
      { category: Category.CHECK_IN, rating: 4.0 },
      { category: Category.ACCURACY, rating: 3.5 },
      { category: Category.LOCATION, rating: 4.0 },
      { category: Category.VALUE, rating: 3.5 },
      { category: Category.OVERALL, rating: 3.8 },
    ],
  },
  {
    hostawayReviewId: 'review_004',
    reviewType: ReviewType.GUEST_REVIEW,
    channel: Channel.AIRBNB,
    rating: 5.0,
    publicReview: 'Perfect stay! Everything was spotless and exactly as advertised. The host provided excellent local recommendations and was always available for questions. Will definitely book again!',
    guestName: 'Michael R.',
    submittedAt: new Date('2024-02-01T16:20:00Z'),
    approved: true,
    rawJson: {
      platform: 'airbnb',
      reviewId: 'airbnb_rev_004',
      guestProfile: {
        verified: true,
        reviewCount: 25,
        superGuest: true,
      },
      amenityRatings: {
        cleanliness: 5,
        communication: 5,
        checkin: 5,
        accuracy: 5,
        location: 5,
        value: 5,
      },
    },
    categories: [
      { category: Category.CLEANLINESS, rating: 5.0 },
      { category: Category.COMMUNICATION, rating: 5.0 },
      { category: Category.CHECK_IN, rating: 5.0 },
      { category: Category.ACCURACY, rating: 5.0 },
      { category: Category.LOCATION, rating: 5.0 },
      { category: Category.VALUE, rating: 5.0 },
      { category: Category.OVERALL, rating: 5.0 },
    ],
  },
];

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  try {
    // Check if data already exists
    const existingListings = await prisma.listing.count();
    if (existingListings > 0) {
      console.log('⚠️ Database already contains data. Skipping seed to prevent duplicates.');
      console.log('💡 Run `npm run db:reset` to clear all data and re-seed.');
      return;
    }

    // Create listings
    console.log('📝 Creating sample listings...');
    const createdListings = [];
    for (const listingData of sampleListings) {
      const listing = await prisma.listing.create({
        data: listingData,
      });
      createdListings.push(listing);
      console.log(`✅ Created listing: ${listing.name}`);
    }

    // Create reviews with categories
    console.log('⭐ Creating sample reviews...');
    for (let i = 0; i < sampleReviews.length; i++) {
      const reviewData = sampleReviews[i];
      if (!reviewData) continue;

      const { categories, ...reviewDataWithoutCategories } = reviewData;
      
      // Assign reviews to different listings
      const listingIndex = i % createdListings.length;
      const listing = createdListings[listingIndex];
      
      if (!listing) {
        console.error(`❌ No listing found at index ${listingIndex}`);
        continue;
      }

      const review = await prisma.review.create({
        data: {
          ...reviewDataWithoutCategories,
          listingId: listing.id,
        },
      });

      // Create review categories
      if (categories) {
        await prisma.reviewCategory.createMany({
          data: categories.map(cat => ({
            reviewId: review.id,
            category: cat.category,
            rating: cat.rating,
          })),
        });
      }

      console.log(`✅ Created review from ${reviewData.guestName} for ${listing.name}`);
    }

    // Print summary
    const stats = await prisma.$transaction([
      prisma.listing.count(),
      prisma.review.count(),
      prisma.reviewCategory.count(),
      prisma.review.count({ where: { approved: true } }),
    ]);

    console.log('\n📊 Seeding completed successfully!');
    console.log('─'.repeat(40));
    console.log(`📋 Listings created: ${stats[0]}`);
    console.log(`⭐ Reviews created: ${stats[1]}`);
    console.log(`🏷️  Review categories created: ${stats[2]}`);
    console.log(`✅ Approved reviews: ${stats[3]}`);
    console.log(`⏳ Pending reviews: ${stats[1]! - stats[3]!}`);
    console.log('─'.repeat(40));
    console.log('🎉 Database is now ready for development!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('💥 Seed script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
