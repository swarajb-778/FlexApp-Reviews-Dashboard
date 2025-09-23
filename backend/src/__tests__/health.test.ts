import request from 'supertest';
import app from '../app';

// Mock the database and Redis modules
jest.mock('../lib/database');
jest.mock('../lib/redis');

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('responseTime');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('pid');

      // Validate response structure
      expect(typeof response.body.uptime).toBe('number');
      expect(typeof response.body.responseTime).toBe('number');
      expect(typeof response.body.memory).toBe('object');
      expect(response.body.memory).toHaveProperty('used');
      expect(response.body.memory).toHaveProperty('total');
      expect(response.body.memory).toHaveProperty('external');
    });

    it('should have reasonable response time', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.body.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include correct content type', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /application\/json/);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status with dependency checks', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('responseTime');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('pid');

      // Validate checks structure
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks).toHaveProperty('redis');
      expect(response.body.checks).toHaveProperty('memory');

      // Validate database check
      expect(response.body.checks.database).toHaveProperty('status', 'healthy');
      expect(response.body.checks.database).toHaveProperty('latency');

      // Validate Redis check
      expect(response.body.checks.redis).toHaveProperty('status', 'healthy');
      expect(response.body.checks.redis).toHaveProperty('latency');

      // Validate memory check
      expect(response.body.checks.memory).toHaveProperty('used');
      expect(response.body.checks.memory).toHaveProperty('total');
      expect(response.body.checks.memory).toHaveProperty('percentage');
    });

    it('should handle database health check failure', async () => {
      // Mock database health check to fail
      const { getDatabaseHealth } = await import('../lib/database');
      (getDatabaseHealth as jest.Mock).mockResolvedValueOnce({
        status: 'unhealthy',
        latency: 5000,
        error: 'Connection timeout',
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.checks.database).toHaveProperty('status', 'unhealthy');
      expect(response.body.checks.database).toHaveProperty('error', 'Connection timeout');
    });

    it('should handle Redis health check failure', async () => {
      // Mock Redis health check to fail
      const { getRedisHealth } = await import('../lib/redis');
      (getRedisHealth as jest.Mock).mockResolvedValueOnce({
        status: 'unhealthy',
        latency: 3000,
        error: 'Connection refused',
      });

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body.checks.redis).toHaveProperty('status', 'unhealthy');
      expect(response.body.checks.redis).toHaveProperty('error', 'Connection refused');
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock database health check to throw an error
      const { getDatabaseHealth } = await import('../lib/database');
      (getDatabaseHealth as jest.Mock).mockRejectedValueOnce(new Error('Unexpected error'));

      const response = await request(app)
        .get('/health/ready')
        .expect(503);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body).toHaveProperty('error', 'Unexpected error');
    });

    it('should have reasonable response time even with checks', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .get('/health/ready')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      expect(response.body.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('pid');

      // Validate timestamp format
      expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
      
      // Validate uptime is a positive number
      expect(response.body.uptime).toBeGreaterThan(0);
      
      // Validate PID is a positive number
      expect(response.body.pid).toBeGreaterThan(0);
    });

    it('should be the fastest health check endpoint', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/health/live')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500); // Should respond within 0.5 seconds
    });

    it('should include correct content type', async () => {
      await request(app)
        .get('/health/live')
        .expect(200)
        .expect('Content-Type', /application\/json/);
    });
  });

  describe('Health endpoints error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with invalid HTTP method
      await request(app)
        .patch('/health')
        .expect(404);
    });

    it('should not be affected by rate limiting', async () => {
      // Health endpoints should not be rate limited
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/health').expect(200)
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed (not rate limited)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Response format consistency', () => {
    it('should return consistent timestamp format across endpoints', async () => {
      const [health, ready, live] = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health/ready'),
        request(app).get('/health/live'),
      ]);

      const timestamps = [health.body.timestamp, ready.body.timestamp, live.body.timestamp];
      
      timestamps.forEach(timestamp => {
        expect(typeof timestamp).toBe('string');
        expect(new Date(timestamp).toString()).not.toBe('Invalid Date');
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });

    it('should return consistent uptime format across endpoints', async () => {
      const [health, ready, live] = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health/ready'),
        request(app).get('/health/live'),
      ]);

      const uptimes = [health.body.uptime, ready.body.uptime, live.body.uptime];
      
      uptimes.forEach(uptime => {
        expect(typeof uptime).toBe('number');
        expect(uptime).toBeGreaterThan(0);
      });
    });
  });
});
