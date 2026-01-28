const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Increase default timeout globally for this file
jest.setTimeout(30000);

// Mock Puppeteer BEFORE requiring app
jest.mock('puppeteer', () => {
  const fs = require('fs');
  const path = require('path');
  const downloadDir = path.resolve(__dirname, '../downloads');
  
  return {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        target: jest.fn().mockReturnValue({
          createCDPSession: jest.fn().mockResolvedValue({
            send: jest.fn().mockResolvedValue({}),
          }),
        }),
        goto: jest.fn().mockResolvedValue({}),
        waitForSelector: jest.fn().mockResolvedValue({}),
        // Pattern-based implementation for multiple calls
        evaluate: jest.fn().mockImplementation((fn, arg) => {
          const script = fn.toString();
          
          if (script.includes('scrollIntoView')) {
            return Promise.resolve();
          }
          if (script.includes('getBoundingClientRect')) {
            return Promise.resolve({ x: 372, y: 300 });
          }
          if (script.includes('el.click()')) {
            // Delay file creation to ensure index.js has captured initialLatest
            setTimeout(() => {
              const fakeFile = path.join(downloadDir, `test-video-${Date.now()}.mp4`);
              fs.writeFileSync(fakeFile, 'fake video content');
            }, 500);
            return Promise.resolve();
          }
          if (script.includes('querySelector("video")')) {
            return Promise.resolve('https://v16-webapp.tiktok.com/fake-video.mp4');
          }
          
          return Promise.resolve();
        }),
        mouse: {
          click: jest.fn().mockResolvedValue({}),
        },
        $: jest.fn().mockResolvedValue({}),
        close: jest.fn().mockResolvedValue({}),
      }),
      close: jest.fn().mockResolvedValue({}),
    }),
  };
});

const app = require('../index');

describe('Social Media Downloader API', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@flexzin.com';
  const adminPass = process.env.ADMIN_PASS || 'changeme123';
  let userToken = '';

  const downloadDir = path.resolve(__dirname, '../downloads');

  beforeAll(() => {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  });

  describe('POST /generate-api-token', () => {
    it('should fail with invalid admin credentials', async () => {
      const response = await request(app)
        .post('/generate-api-token')
        .send({
          email: 'test@user.com',
          allowedRequests: 10,
          adminEmail: 'wrong@admin.com',
          adminPass: 'wrongpass'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid admin credentials');
    });

    it('should succeed with valid admin credentials', async () => {
      const response = await request(app)
        .post('/generate-api-token')
        .send({
          email: 'test@user.com',
          allowedRequests: 5,
          adminEmail: adminEmail,
          adminPass: adminPass
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      userToken = response.body.token;
    });
  });

  describe('POST /tiktok', () => {
    it('should fail without a token', async () => {
      const response = await request(app)
        .post('/tiktok')
        .send({ url: 'https://www.tiktok.com/@user/video/123' });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('API token is required');
    });

    it('should fail with an invalid token', async () => {
      const response = await request(app)
        .post('/tiktok')
        .set('x-api-token', 'invalid-token-here')
        .send({ url: 'https://www.tiktok.com/@user/video/123' });
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should succeed with a valid token and return video', async () => {
      const response = await request(app)
        .post('/tiktok')
        .set('x-api-token', userToken)
        .send({ url: 'https://www.tiktok.com/@user/video/123' });
      
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('video/mp4');
    });

    it('should fail when request limit is exceeded', async () => {
      // Setup: Generate a token with limit 1
      const tokenRes = await request(app)
        .post('/generate-api-token')
        .send({
          email: 'limit@test.com',
          allowedRequests: 1,
          adminEmail: adminEmail,
          adminPass: adminPass
        });
      
      const newLimitToken = tokenRes.body.token;

      // 1st request - Success
      const firstRes = await request(app)
        .post('/tiktok')
        .set('x-api-token', newLimitToken)
        .send({ url: 'https://www.tiktok.com/@user/video/123' });
      expect(firstRes.status).toBe(200);

      // 2nd request - Should fail with 402
      const secondRes = await request(app)
        .post('/tiktok')
        .set('x-api-token', newLimitToken)
        .send({ url: 'https://www.tiktok.com/@user/video/123' });
      
      expect(secondRes.status).toBe(402);
      expect(secondRes.body.error).toContain('Request limit exceeded');
    });
  });
});
