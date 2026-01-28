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
        evaluate: jest.fn().mockImplementation((fn, arg) => {
          const script = fn.toString();
          
          if (script.includes('scrollIntoView')) return Promise.resolve();
          if (script.includes('getBoundingClientRect')) return Promise.resolve({ x: 372, y: 300 });
          if (script.includes('el.click()')) {
            setTimeout(() => {
              const fakeFile = path.join(downloadDir, `test-video-${Date.now()}.mp4`);
              fs.writeFileSync(fakeFile, 'fake video content');
            }, 500);
            return Promise.resolve();
          }
          if (script.includes('querySelector("video")')) return Promise.resolve('https://v16-webapp.tiktok.com/fake-video.mp4');
          return Promise.resolve();
        }),
        mouse: { click: jest.fn().mockResolvedValue({}) },
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
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
  });

  describe('Admin Endpoints', () => {
    it('should fail /admin/generate-token with invalid credentials', async () => {
      const response = await request(app)
        .post('/admin/generate-token')
        .send({ email: 'test@user.com', allowedRequests: 10, adminEmail: 'bad', adminPass: 'bad' });
      expect(response.status).toBe(401);
    });

    it('should succeed /admin/generate-token and return token', async () => {
      const response = await request(app)
        .post('/admin/generate-token')
        .send({ email: 'test@user.com', allowedRequests: 5, adminEmail, adminPass });
      expect(response.status).toBe(200);
      userToken = response.body.token;
    });

    it('should succeed /admin/tokens for admin', async () => {
      const response = await request(app)
        .post('/admin/tokens')
        .send({ adminEmail, adminPass });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.tokens)).toBe(true);
    });
  });

  describe('User Endpoints', () => {
    it('should fail /validate-token without token', async () => {
      const response = await request(app).get('/validate-token');
      expect(response.status).toBe(401);
    });

    it('should succeed /validate-token with valid token', async () => {
      const response = await request(app)
        .get('/validate-token')
        .set('x-api-token', userToken);
      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@user.com');
    });

    it('should succeed /tiktok with valid token', async () => {
      const response = await request(app)
        .post('/tiktok')
        .set('x-api-token', userToken)
        .send({ url: 'https://www.tiktok.com/@user/video/123' });
      expect(response.status).toBe(200);
      expect(response.header['content-type']).toContain('video/mp4');
    });

    it('should fail /tiktok when limit exceeded', async () => {
      const tokenRes = await request(app)
        .post('/admin/generate-token')
        .send({ email: 'limit@test.com', allowedRequests: 1, adminEmail, adminPass });
      const limitToken = tokenRes.body.token;

      await request(app).post('/tiktok').set('x-api-token', limitToken).send({ url: 'url' });
      const secondRes = await request(app).post('/tiktok').set('x-api-token', limitToken).send({ url: 'url' });
      expect(secondRes.status).toBe(402);
    });
  });
});
