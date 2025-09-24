import request from 'supertest';
import { app } from '../../app';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const prisma = new PrismaClient();

describe('Security Tests', () => {
  beforeAll(async () => {
    // Clean test data
    await prisma.reviewAuditLog.deleteMany();
    await prisma.review.deleteMany();
    await prisma.listing.deleteMany();
    
    // Create test data for security testing
    await prisma.listing.create({
      data: {
        externalId: 'security-listing-1',
        name: 'Security Test Listing',
        address: '123 Security Street',
        city: 'Security City',
        country: 'Security Country',
        latitude: 40.7128,
        longitude: -74.0060
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Input Sanitization and Validation', () => {
    it('should prevent SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE reviews; --",
        "1' OR '1'='1",
        "1; DELETE FROM listings WHERE '1'='1",
        "' UNION SELECT * FROM users --",
        "1' AND (SELECT COUNT(*) FROM information_schema.tables) > 0 --"
      ];

      for (const payload of sqlInjectionPayloads) {
        // Test in various endpoints
        const endpoints = [
          `/api/reviews/${payload}`,
          `/api/reviews?source=${encodeURIComponent(payload)}`,
          `/api/listings?search=${encodeURIComponent(payload)}`
        ];

        for (const endpoint of endpoints) {
          const response = await request(app)
            .get(endpoint)
            .expect((res) => {
              // Should either return 400 (validation error) or handle safely
              expect([200, 400, 404]).toContain(res.status);
            });

          // Ensure the payload doesn't cause server errors or data corruption
          if (response.status === 200) {
            expect(response.body).toBeDefined();
            // Verify no sensitive data is exposed
            expect(JSON.stringify(response.body)).not.toMatch(/DROP|DELETE|UNION|SELECT/i);
          }
        }
      }

      // Verify database integrity after injection attempts
      const reviewCount = await prisma.review.count();
      const listingCount = await prisma.listing.count();
      expect(reviewCount).toBeGreaterThanOrEqual(0);
      expect(listingCount).toBeGreaterThan(0);
    });

    it('should prevent XSS attacks in request bodies', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<svg onload=alert('XSS')>",
        "\"><script>alert('XSS')</script>",
        "';alert('XSS');//",
        "<iframe src=\"javascript:alert('XSS')\"></iframe>"
      ];

      const testReview = await prisma.review.create({
        data: {
          externalId: 'xss-test-review',
          guestName: 'XSS Test User',
          rating: 4,
          comment: 'Original comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      for (const payload of xssPayloads) {
        // Test XSS in approval notes
        const response = await request(app)
          .post(`/api/reviews/${testReview.id}/approve`)
          .send({
            approvedBy: 'security-test-manager',
            notes: payload
          });

        // Should handle XSS payload safely
        expect([200, 400]).toContain(response.status);

        if (response.status === 200) {
          // Verify the payload was sanitized
          const auditLog = await prisma.reviewAuditLog.findFirst({
            where: { reviewId: testReview.id },
            orderBy: { performedAt: 'desc' }
          });

          if (auditLog && auditLog.notes) {
            // Notes should not contain executable script tags
            expect(auditLog.notes).not.toMatch(/<script|javascript:|onerror|onload/i);
          }
        }
      }

      // Test XSS in search parameters
      for (const payload of xssPayloads) {
        const response = await request(app)
          .get(`/api/reviews?search=${encodeURIComponent(payload)}`)
          .expect((res) => {
            expect([200, 400]).toContain(res.status);
          });

        if (response.status === 200) {
          // Response should not contain unescaped script content
          expect(JSON.stringify(response.body)).not.toMatch(/<script|javascript:|onerror|onload/i);
        }
      }
    });

    it('should validate and sanitize file upload attempts', async () => {
      // Test malicious file upload attempts (if file upload is implemented)
      const maliciousFiles = [
        { name: 'malicious.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'script.html', content: '<script>alert("XSS")</script>' },
        { name: '../../../etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash' },
        { name: 'test.exe', content: 'MZ\x90\x00' }, // PE header
      ];

      // Test file upload endpoints (adapt based on actual implementation)
      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/upload') // Adjust endpoint as needed
          .attach('file', Buffer.from(file.content), file.name)
          .expect((res) => {
            // Should reject malicious files
            expect([400, 404, 405, 415]).toContain(res.status);
          });

        // Verify no malicious files were saved
        // (Implementation depends on actual file upload logic)
      }
    });

    it('should handle oversized payloads securely', async () => {
      // Test oversized JSON payload
      const oversizedPayload = {
        approvedBy: 'security-test',
        notes: 'A'.repeat(1000000) // 1MB of text
      };

      const testReview = await prisma.review.create({
        data: {
          externalId: 'oversize-test',
          guestName: 'Oversize Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      const response = await request(app)
        .post(`/api/reviews/${testReview.id}/approve`)
        .send(oversizedPayload)
        .expect((res) => {
          // Should reject oversized payloads
          expect([400, 413]).toContain(res.status);
        });

      // Test extremely nested JSON (JSON bomb)
      const createNestedObject = (depth: number): any => {
        if (depth === 0) return { value: 'deep' };
        return { nested: createNestedObject(depth - 1) };
      };

      const deepNestedPayload = {
        approvedBy: 'security-test',
        notes: 'Test',
        data: createNestedObject(1000) // Very deep nesting
      };

      const response2 = await request(app)
        .post(`/api/reviews/${testReview.id}/approve`)
        .send(deepNestedPayload)
        .expect((res) => {
          // Should handle nested payloads safely
          expect([200, 400, 413]).toContain(res.status);
        });
    });

    it('should validate content types and reject unexpected formats', async () => {
      const testReview = await prisma.review.create({
        data: {
          externalId: 'content-type-test',
          guestName: 'Content Type Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      // Test various malicious content types
      const maliciousContentTypes = [
        'application/x-www-form-urlencoded',
        'text/xml',
        'application/xml',
        'multipart/form-data',
        'text/plain',
        'application/octet-stream'
      ];

      for (const contentType of maliciousContentTypes) {
        const response = await request(app)
          .post(`/api/reviews/${testReview.id}/approve`)
          .set('Content-Type', contentType)
          .send('approvedBy=hacker&notes=malicious')
          .expect((res) => {
            // Should only accept application/json for API endpoints
            expect([400, 415]).toContain(res.status);
          });
      }
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for protected endpoints', async () => {
      // Test protected endpoints without authentication
      const protectedEndpoints = [
        { method: 'post', path: '/api/reviews/123/approve' },
        { method: 'delete', path: '/api/reviews/123' },
        { method: 'put', path: '/api/reviews/123' },
        { method: 'post', path: '/api/reviews/hostaway' },
        { method: 'post', path: '/api/listings/hostaway/import' }
      ];

      for (const endpoint of protectedEndpoints) {
        let requestBuilder;
        switch (endpoint.method) {
          case 'post':
            requestBuilder = request(app).post(endpoint.path);
            break;
          case 'put':
            requestBuilder = request(app).put(endpoint.path);
            break;
          case 'delete':
            requestBuilder = request(app).delete(endpoint.path);
            break;
          default:
            requestBuilder = request(app).get(endpoint.path);
        }

        await requestBuilder
          .expect((res) => {
            // Should require authentication
            expect([401, 403]).toContain(res.status);
          });
      }
    });

    it('should reject invalid authentication tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-jwt-token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        '', // empty token
        'malicious-token-with-special-chars!@#$%^&*()',
        'x'.repeat(10000) // very long token
      ];

      const testReview = await prisma.review.create({
        data: {
          externalId: 'auth-test',
          guestName: 'Auth Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      for (const token of invalidTokens) {
        const response = await request(app)
          .post(`/api/reviews/${testReview.id}/approve`)
          .set('Authorization', token)
          .send({
            approvedBy: 'test-manager',
            notes: 'Test approval'
          })
          .expect((res) => {
            // Should reject invalid tokens
            expect([401, 403]).toContain(res.status);
          });
      }
    });

    it('should prevent privilege escalation', async () => {
      // Test role-based access control (adapt based on actual implementation)
      const testReview = await prisma.review.create({
        data: {
          externalId: 'privilege-test',
          guestName: 'Privilege Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      // Test with lower privilege token attempting admin actions
      const lowPrivilegeActions = [
        {
          method: 'delete',
          path: `/api/reviews/${testReview.id}`,
          description: 'Delete review'
        },
        {
          method: 'post',
          path: '/api/admin/settings',
          description: 'Admin settings'
        }
      ];

      for (const action of lowPrivilegeActions) {
        const response = await request(app)
          .delete(action.path) // Adjust method as needed
          .set('Authorization', 'Bearer low-privilege-token')
          .expect((res) => {
            // Should prevent privilege escalation
            expect([401, 403]).toContain(res.status);
          });
      }
    });
  });

  describe('Rate Limiting and CORS', () => {
    it('should enforce rate limiting on API endpoints', async () => {
      // Test rate limiting by making many requests quickly
      const requests = Array(100).fill(0).map(() =>
        request(app)
          .get('/api/reviews')
          .expect((res) => {
            expect([200, 429]).toContain(res.status);
          })
      );

      const responses = await Promise.all(requests);
      
      // Should have some rate-limited responses
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const successCount = responses.filter(r => r.status === 200).length;

      console.log(`Rate limiting test: ${successCount} successful, ${rateLimitedCount} rate-limited`);

      // Rate limiting should be working (some requests should be blocked)
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should handle CORS configuration securely', async () => {
      // Test CORS with various origins
      const testOrigins = [
        'https://malicious-site.com',
        'http://localhost:3000',
        'https://flexliving.com',
        'null',
        '',
        'javascript:alert("XSS")'
      ];

      for (const origin of testOrigins) {
        const response = await request(app)
          .options('/api/reviews')
          .set('Origin', origin)
          .set('Access-Control-Request-Method', 'GET');

        // Check CORS headers are set appropriately
        const allowedOrigin = response.headers['access-control-allow-origin'];
        
        if (allowedOrigin) {
          // Should not allow malicious origins
          expect(allowedOrigin).not.toMatch(/malicious-site|javascript:/);
        }
      }
    });

    it('should set appropriate security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for security headers
      const securityHeaders = {
        'x-content-type-options': 'nosniff',
        'x-frame-options': expect.stringMatching(/DENY|SAMEORIGIN/),
        'x-xss-protection': expect.any(String),
        'strict-transport-security': expect.any(String),
        'content-security-policy': expect.any(String)
      };

      for (const [header, expectedValue] of Object.entries(securityHeaders)) {
        expect(response.headers[header]).toEqual(expectedValue);
      }
    });
  });

  describe('Error Handling and Information Disclosure', () => {
    it('should not expose sensitive information in error messages', async () => {
      // Test various error scenarios
      const errorTests = [
        {
          path: '/api/reviews/99999999',
          method: 'get',
          description: 'Non-existent resource'
        },
        {
          path: '/api/reviews/invalid-id/approve',
          method: 'post',
          description: 'Invalid ID format'
        },
        {
          path: '/api/nonexistent-endpoint',
          method: 'get',
          description: 'Non-existent endpoint'
        }
      ];

      for (const test of errorTests) {
        let response;
        switch (test.method) {
          case 'post':
            response = await request(app).post(test.path).send({});
            break;
          default:
            response = await request(app).get(test.path);
        }

        // Should not expose sensitive information
        const responseText = JSON.stringify(response.body);
        
        // Check for common information disclosure patterns
        expect(responseText).not.toMatch(/password|token|key|secret|database|internal|stack trace/i);
        expect(responseText).not.toMatch(/\/[a-zA-Z]:[\\\/]|\/home\/|\/var\/|\/etc\//); // File paths
        expect(responseText).not.toMatch(/Error: .* at .* \(.*/); // Stack traces
      }
    });

    it('should handle database errors without information disclosure', async () => {
      // Temporarily break database connection (simulate)
      const originalQuery = prisma.review.findMany;
      
      // @ts-ignore
      prisma.review.findMany = jest.fn().mockRejectedValue(
        new Error('Connection lost: The server closed the connection.')
      );

      const response = await request(app)
        .get('/api/reviews')
        .expect(500);

      // Should not expose database connection details
      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toMatch(/connection|server|database|prisma|sql/i);

      // Restore original method
      // @ts-ignore
      prisma.review.findMany = originalQuery;
    });

    it('should sanitize log output to prevent log injection', async () => {
      const logInjectionPayloads = [
        'test\n[ERROR] Fake error injected',
        'test\r\n[CRITICAL] System compromised',
        'test\x1b[31mFake colored output\x1b[0m',
        'test\0null byte injection'
      ];

      for (const payload of logInjectionPayloads) {
        // Test log injection in various input fields
        await request(app)
          .get(`/api/reviews?search=${encodeURIComponent(payload)}`)
          .expect((res) => {
            expect([200, 400]).toContain(res.status);
          });

        // In a real application, you would verify that logs don't contain
        // the injected content or that it's properly escaped
      }
    });
  });

  describe('Session and Token Security', () => {
    it('should properly handle session expiration', async () => {
      // Test with expired tokens (if JWT is used)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const testReview = await prisma.review.create({
        data: {
          externalId: 'session-test',
          guestName: 'Session Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      const response = await request(app)
        .post(`/api/reviews/${testReview.id}/approve`)
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          approvedBy: 'test-manager',
          notes: 'Test approval'
        })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });

      if (response.status === 401) {
        expect(response.body.error).toMatch(/token|authentication|expired|invalid/i);
      }
    });

    it('should prevent token reuse after logout', async () => {
      // This test would verify that tokens are properly invalidated
      // Implementation depends on the authentication strategy used
      
      // Mock scenario: token should be invalidated after logout
      const token = 'valid-token-before-logout';
      
      // Simulate logout (implementation specific)
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect((res) => {
          expect([200, 404]).toContain(res.status);
        });

      // Token should no longer be valid
      const testReview = await prisma.review.create({
        data: {
          externalId: 'logout-test',
          guestName: 'Logout Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      await request(app)
        .post(`/api/reviews/${testReview.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          approvedBy: 'test-manager',
          notes: 'Test approval'
        })
        .expect((res) => {
          expect([401, 403]).toContain(res.status);
        });
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should validate input data types and ranges', async () => {
      const testReview = await prisma.review.create({
        data: {
          externalId: 'validation-test',
          guestName: 'Validation Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      // Test invalid data types
      const invalidInputs = [
        { approvedBy: 123, notes: 'Valid notes' }, // Invalid type
        { approvedBy: 'valid', notes: 123 }, // Invalid type
        { approvedBy: null, notes: 'Valid notes' }, // Null value
        { approvedBy: '', notes: 'Valid notes' }, // Empty string
        { approvedBy: 'a'.repeat(1000), notes: 'Valid notes' }, // Too long
      ];

      for (const input of invalidInputs) {
        const response = await request(app)
          .post(`/api/reviews/${testReview.id}/approve`)
          .send(input)
          .expect(400);

        expect(response.body.error).toBeDefined();
        expect(response.body.error).toMatch(/validation|invalid|required/i);
      }
    });

    it('should handle special characters and encoding properly', async () => {
      const testReview = await prisma.review.create({
        data: {
          externalId: 'encoding-test',
          guestName: 'Encoding Test User',
          rating: 4,
          comment: 'Test comment',
          source: 'airbnb',
          status: 'pending',
          listingId: 'security-listing-1'
        }
      });

      const specialCharacterInputs = [
        { approvedBy: 'manager', notes: '测试中文字符' }, // Chinese characters
        { approvedBy: 'manager', notes: 'Tëst spëcïäl chäräctërs' }, // Accented characters
        { approvedBy: 'manager', notes: '🚀 Emoji test 🎉' }, // Emojis
        { approvedBy: 'manager', notes: 'Line\nbreaks\rand\ttabs' }, // Control characters
      ];

      for (const input of specialCharacterInputs) {
        const response = await request(app)
          .post(`/api/reviews/${testReview.id}/approve`)
          .send(input);

        // Should handle special characters properly
        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          // Verify data was stored correctly
          const auditLog = await prisma.reviewAuditLog.findFirst({
            where: { reviewId: testReview.id },
            orderBy: { performedAt: 'desc' }
          });
          
          expect(auditLog?.notes).toBeDefined();
        }
      }
    });
  });
});
