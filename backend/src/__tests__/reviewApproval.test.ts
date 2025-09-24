/**
 * Integration tests for the review approval endpoint
 * Tests PATCH /api/reviews/:id/approve and related endpoints
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../app';
import { db } from '../lib/database';

// Test database instance
let testDb: PrismaClient;

describe('Review Approval API', () => {
  let testListingId: string;
  let approvedReviewId: string;
  let unapprovedReviewId: string;
  let reviewIds: string[] = [];

  beforeAll(async () => {
    testDb = db;
    
    // Clean up existing test data
    await testDb.reviewCategory.deleteMany();
    await testDb.review.deleteMany();
    await testDb.listing.deleteMany();
    
    // Seed test data
    const seedData = await seedTestData();
    testListingId = seedData.listingId;
    approvedReviewId = seedData.approvedReviewId;
    unapprovedReviewId = seedData.unapprovedReviewId;
    reviewIds = seedData.reviewIds;
  });

  afterAll(async () => {
    // Clean up test data
    await testDb.reviewCategory.deleteMany();
    await testDb.review.deleteMany();
    await testDb.listing.deleteMany();
    
    await testDb.$disconnect();
  });

  describe('PATCH /api/reviews/:id/approve', () => {
    it('should approve an unapproved review', async () => {
      const response = await request(app)
        .patch(`/api/reviews/${unapprovedReviewId}/approve`)
        .send({
          approved: true,
          response: 'Thank you for your feedback!'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.review.approved).toBe(true);
      expect(response.body.data.meta.action).toBe('approved');
      expect(response.body.data.meta.previousStatus).toBe(false);
      expect(response.body.message).toContain('approved successfully');

      // Verify the review was actually updated in the database
      const updatedReview = await testDb.review.findUnique({
        where: { id: unapprovedReviewId }
      });
      expect(updatedReview?.approved).toBe(true);
    });

    it('should unapprove an approved review', async () => {
      const response = await request(app)
        .patch(`/api/reviews/${approvedReviewId}/approve`)
        .send({
          approved: false
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.review.approved).toBe(false);
      expect(response.body.data.meta.action).toBe('unapproved');
      expect(response.body.data.meta.previousStatus).toBe(true);

      // Verify the review was actually updated in the database
      const updatedReview = await testDb.review.findUnique({
        where: { id: approvedReviewId }
      });
      expect(updatedReview?.approved).toBe(false);
    });

    it('should approve a review with a response', async () => {
      // First ensure the review is unapproved
      await testDb.review.update({
        where: { id: unapprovedReviewId },
        data: { approved: false }
      });

      const response = await request(app)
        .patch(`/api/reviews/${unapprovedReviewId}/approve`)
        .send({
          approved: true,
          response: 'We appreciate your kind words!'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.review.approved).toBe(true);
      
      // Check that response is stored in rawJson
      const updatedReview = await testDb.review.findUnique({
        where: { id: unapprovedReviewId }
      });
      const rawJson = updatedReview?.rawJson as any;
      expect(rawJson?.response).toBe('We appreciate your kind words!');
      expect(rawJson?.responseDate).toBeDefined();
    });

    it('should return error for non-existent review', async () => {
      const fakeId = 'c' + '1'.repeat(24);
      
      const response = await request(app)
        .patch(`/api/reviews/${fakeId}/approve`)
        .send({
          approved: true
        })
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Review not found');
    });

    it('should return error for invalid review ID format', async () => {
      const response = await request(app)
        .patch('/api/reviews/invalid-id/approve')
        .send({
          approved: true
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for missing approval status', async () => {
      const response = await request(app)
        .patch(`/api/reviews/${unapprovedReviewId}/approve`)
        .send({})
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for invalid request body', async () => {
      const response = await request(app)
        .patch(`/api/reviews/${unapprovedReviewId}/approve`)
        .send({
          approved: 'not-a-boolean'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error when trying to approve already approved review', async () => {
      // Ensure review is approved first
      await testDb.review.update({
        where: { id: approvedReviewId },
        data: { approved: true }
      });

      const response = await request(app)
        .patch(`/api/reviews/${approvedReviewId}/approve`)
        .send({
          approved: true
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NO_CHANGE_REQUIRED');
      expect(response.body.message).toContain('already approved');
    });

    it('should include proper response headers', async () => {
      const response = await request(app)
        .patch(`/api/reviews/${unapprovedReviewId}/approve`)
        .send({
          approved: false
        })
        .expect(200);

      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).toHaveProperty('x-response-time');
    });
  });

  describe('PATCH /api/reviews/:id/unapprove', () => {
    beforeEach(async () => {
      // Ensure review is approved before each test
      await testDb.review.update({
        where: { id: approvedReviewId },
        data: { approved: true }
      });
    });

    it('should unapprove an approved review', async () => {
      const response = await request(app)
        .patch(`/api/reviews/${approvedReviewId}/unapprove`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.review.approved).toBe(false);
      expect(response.body.data.meta.action).toBe('unapproved');
      expect(response.body.message).toContain('unapproved successfully');

      // Verify database update
      const updatedReview = await testDb.review.findUnique({
        where: { id: approvedReviewId }
      });
      expect(updatedReview?.approved).toBe(false);
    });

    it('should return error for already unapproved review', async () => {
      // First unapprove the review
      await testDb.review.update({
        where: { id: approvedReviewId },
        data: { approved: false }
      });

      const response = await request(app)
        .patch(`/api/reviews/${approvedReviewId}/unapprove`)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NO_CHANGE_REQUIRED');
      expect(response.body.message).toContain('already unapproved');
    });

    it('should return error for non-existent review', async () => {
      const fakeId = 'c' + '1'.repeat(24);
      
      const response = await request(app)
        .patch(`/api/reviews/${fakeId}/unapprove`)
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/reviews/bulk-approve', () => {
    beforeEach(async () => {
      // Reset all test reviews to unapproved
      await testDb.review.updateMany({
        where: { id: { in: reviewIds } },
        data: { approved: false }
      });
    });

    it('should bulk approve multiple reviews', async () => {
      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: reviewIds.slice(0, 3),
          approved: true,
          response: 'Thank you all for your feedback!'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.result.updated).toBe(3);
      expect(response.body.data.result.failed).toBe(0);
      expect(response.body.data.result.success).toBe(true);

      // Verify database updates
      const updatedReviews = await testDb.review.findMany({
        where: { id: { in: reviewIds.slice(0, 3) } }
      });
      updatedReviews.forEach(review => {
        expect(review.approved).toBe(true);
      });
    });

    it('should bulk unapprove multiple reviews', async () => {
      // First approve all reviews
      await testDb.review.updateMany({
        where: { id: { in: reviewIds } },
        data: { approved: true }
      });

      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: reviewIds.slice(0, 2),
          approved: false
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.result.updated).toBe(2);
      expect(response.body.data.result.failed).toBe(0);

      // Verify database updates
      const updatedReviews = await testDb.review.findMany({
        where: { id: { in: reviewIds.slice(0, 2) } }
      });
      updatedReviews.forEach(review => {
        expect(review.approved).toBe(false);
      });
    });

    it('should handle partial success in bulk operations', async () => {
      const validIds = reviewIds.slice(0, 2);
      const invalidId = 'c' + '9'.repeat(24);
      const mixedIds = [...validIds, invalidId];

      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: mixedIds,
          approved: true
        })
        .expect(207); // Partial success

      expect(response.body.status).toBe('partial_success');
      expect(response.body.data.result.updated).toBe(2);
      expect(response.body.data.result.failed).toBe(1);
      expect(response.body.data.result.success).toBe(false);
      expect(response.body.data.result.errors).toHaveLength(1);
    });

    it('should return error for empty review IDs array', async () => {
      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: [],
          approved: true
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for too many review IDs', async () => {
      const tooManyIds = Array(101).fill('c' + '1'.repeat(24));
      
      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: tooManyIds,
          approved: true
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for invalid review ID format in bulk', async () => {
      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: ['invalid-id', reviewIds[0]],
          approved: true
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return error for missing approved field', async () => {
      const response = await request(app)
        .post('/api/reviews/bulk-approve')
        .send({
          reviewIds: reviewIds.slice(0, 2)
          // missing approved field
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/reviews/:id/approval-history', () => {
    it('should return approval history for a review', async () => {
      const response = await request(app)
        .get(`/api/reviews/${approvedReviewId}/approval-history`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('reviewId', approvedReviewId);
      expect(response.body.data).toHaveProperty('currentStatus');
      expect(response.body.data).toHaveProperty('history');
      expect(response.body.data.meta).toHaveProperty('note', 'Audit log implementation pending');
    });

    it('should return error for non-existent review', async () => {
      const fakeId = 'c' + '1'.repeat(24);
      
      const response = await request(app)
        .get(`/api/reviews/${fakeId}/approval-history`)
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return error for invalid review ID format', async () => {
      const response = await request(app)
        .get('/api/reviews/invalid-id/approval-history')
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});

/**
 * Seed test data for review approval tests
 */
async function seedTestData() {
  // Create test listing
  const listing = await testDb.listing.create({
    data: {
      hostawayListingId: '98765',
      name: 'Approval Test Listing',
      slug: 'approval-test-listing'
    }
  });

  // Create test reviews
  const review1 = await testDb.review.create({
    data: {
      hostawayReviewId: 'hr_approve_001',
      listingId: listing.id,
      reviewType: 'GUEST_REVIEW',
      channel: 'AIRBNB',
      rating: 8.5,
      publicReview: 'Great place for approval testing!',
      guestName: 'Test Approver 1',
      submittedAt: new Date('2023-06-01'),
      approved: true,
      rawJson: { source: 'approval_test' }
    }
  });

  const review2 = await testDb.review.create({
    data: {
      hostawayReviewId: 'hr_approve_002',
      listingId: listing.id,
      reviewType: 'GUEST_REVIEW',
      channel: 'BOOKING_COM',
      rating: 7.0,
      publicReview: 'Needs approval testing',
      guestName: 'Test Approver 2',
      submittedAt: new Date('2023-06-02'),
      approved: false,
      rawJson: { source: 'approval_test' }
    }
  });

  const review3 = await testDb.review.create({
    data: {
      hostawayReviewId: 'hr_approve_003',
      listingId: listing.id,
      reviewType: 'GUEST_REVIEW',
      channel: 'VRBO',
      rating: 9.0,
      publicReview: 'Bulk approval test',
      guestName: 'Test Approver 3',
      submittedAt: new Date('2023-06-03'),
      approved: false,
      rawJson: { source: 'approval_test' }
    }
  });

  const review4 = await testDb.review.create({
    data: {
      hostawayReviewId: 'hr_approve_004',
      listingId: listing.id,
      reviewType: 'GUEST_REVIEW',
      channel: 'GOOGLE',
      rating: 8.0,
      publicReview: 'Another bulk test',
      guestName: 'Test Approver 4',
      submittedAt: new Date('2023-06-04'),
      approved: false,
      rawJson: { source: 'approval_test' }
    }
  });

  const review5 = await testDb.review.create({
    data: {
      hostawayReviewId: 'hr_approve_005',
      listingId: listing.id,
      reviewType: 'GUEST_REVIEW',
      channel: 'DIRECT',
      rating: 7.5,
      publicReview: 'Final bulk test review',
      guestName: 'Test Approver 5',
      submittedAt: new Date('2023-06-05'),
      approved: false,
      rawJson: { source: 'approval_test' }
    }
  });

  return {
    listingId: listing.id,
    approvedReviewId: review1.id,
    unapprovedReviewId: review2.id,
    reviewIds: [review1.id, review2.id, review3.id, review4.id, review5.id]
  };
}
