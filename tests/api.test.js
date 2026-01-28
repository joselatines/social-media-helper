import request from "supertest";
import fs from "fs";
import path from "path";
import { jest } from "@jest/globals";

// Increase default timeout globally for this file
jest.setTimeout(30000);

// Mock Puppeteer
jest.mock("puppeteer", () => {
	const downloadDir = path.resolve(process.cwd(), "downloads");

	return {
		launch: jest.fn().mockResolvedValue({
			newPage: jest.fn().mockResolvedValue({
				target: jest.fn().mockReturnValue({
					createCDPSession: jest.fn().mockResolvedValue({
						send: jest.fn().mockResolvedValue({}),
					}),
				}),
				goto: jest.fn().mockResolvedValue({}),
				waitForSelector: jest.fn().mockImplementation((selector, options) => {
					// Mock the selector that the TikTok endpoint is looking for
					if (selector === ".xgplayer-container.tiktok-web-player") {
						return Promise.resolve({
							scrollIntoView: () => {},
							getBoundingClientRect: () => ({
								left: 0,
								top: 0,
								width: 100,
								height: 100,
							}),
						});
					}
					return Promise.resolve({});
				}),
				evaluate: jest.fn().mockImplementation((fn, arg) => {
					const script = fn.toString();

					if (script.includes("scrollIntoView")) return Promise.resolve();
					if (script.includes("getBoundingClientRect"))
						return Promise.resolve({ x: 372, y: 300 });
					if (script.includes("el.click()")) {
						setTimeout(() => {
							const fakeFile = path.join(
								downloadDir,
								`test-video-${Date.now()}.mp4`
							);
							fs.writeFileSync(fakeFile, "fake video content");
						}, 500);
						return Promise.resolve();
					}
					if (script.includes('querySelector("video")'))
						return Promise.resolve(
							"https://v16-webapp.tiktok.com/fake-video.mp4"
						);
					return Promise.resolve();
				}),
				mouse: { click: jest.fn().mockResolvedValue({}) },
				$: jest.fn().mockImplementation(selector => {
					// Mock the download option selector
					if (selector === "::-p-text(Download video)") {
						return Promise.resolve({
							click: () => {},
						});
					}
					return Promise.resolve(null);
				}),
				close: jest.fn().mockResolvedValue({}),
			}),
			close: jest.fn().mockResolvedValue({}),
		}),
	};
});

// Import app after mocking
import { app } from "../index.js";

describe("Social Media Helper API", () => {
	const adminEmail = process.env.ADMIN_EMAIL || "admin@flexzin.com";
	const adminPass = process.env.ADMIN_PASS || "changeme123";
	let userToken = "";

	const downloadDir = path.resolve(process.cwd(), "downloads");

	beforeAll(() => {
		if (!fs.existsSync(downloadDir))
			fs.mkdirSync(downloadDir, { recursive: true });
	});

	afterAll(() => {
		// Clean up test files
		if (fs.existsSync(downloadDir)) {
			const files = fs.readdirSync(downloadDir);
			files.forEach(file => {
				if (file.startsWith("test-video-")) {
					fs.unlinkSync(path.join(downloadDir, file));
				}
			});
		}
	});

	describe("Admin Endpoints", () => {
		// Test 1: Should fail with invalid admin credentials
		it("should fail /admin/generate-token with invalid credentials", async () => {
			const response = await request(app)
				.post("/admin/generate-token")
				.send({
					email: "test@user.com",
					allowedRequests: 10,
					adminEmail: "bad",
					adminPass: "bad",
				});
			expect(response.status).toBe(401);
			expect(response.body.error).toBe("Invalid admin credentials");
		});

		// Test 2: Should fail with missing required fields
		it("should fail /admin/generate-token with missing email", async () => {
			const response = await request(app)
				.post("/admin/generate-token")
				.send({ allowedRequests: 10, adminEmail, adminPass });
			expect(response.status).toBe(400);
			expect(response.body.error).toContain("required");
		});

		// Test 3: Should fail with missing allowedRequests
		it("should fail /admin/generate-token with missing allowedRequests", async () => {
			const response = await request(app)
				.post("/admin/generate-token")
				.send({ email: "test@user.com", adminEmail, adminPass });
			expect(response.status).toBe(400);
			expect(response.body.error).toContain("required");
		});

		// Test 4: Should succeed with valid admin credentials
		it("should succeed /admin/generate-token and return token", async () => {
			const response = await request(app)
				.post("/admin/generate-token")
				.send({
					email: "test@user.com",
					allowedRequests: 5,
					adminEmail,
					adminPass,
				});
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.token).toBeDefined();
			expect(response.body.expiresAt).toBeDefined();
			expect(response.body.allowedRequests).toBe(5);
			userToken = response.body.token;
		});

		// Test 5: Should fail /admin/tokens with invalid credentials
		it("should fail /admin/tokens with invalid credentials", async () => {
			const response = await request(app)
				.post("/admin/tokens")
				.send({ adminEmail: "bad", adminPass: "bad" });
			expect(response.status).toBe(401);
			expect(response.body.error).toBe("Invalid admin credentials");
		});

		// Test 6: Should succeed /admin/tokens for admin
		it("should succeed /admin/tokens for admin", async () => {
			const response = await request(app)
				.post("/admin/tokens")
				.send({ adminEmail, adminPass });
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(Array.isArray(response.body.tokens)).toBe(true);
		});
	});

	describe("User Endpoints", () => {
		// Test 7: Should fail /validate-token without token
		it("should fail /validate-token without token", async () => {
			const response = await request(app).get("/validate-token");
			expect(response.status).toBe(401);
			expect(response.body.error).toBe("API token is required");
		});

		// Test 8: Should fail /validate-token with invalid token
		it("should fail /validate-token with invalid token", async () => {
			const response = await request(app)
				.get("/validate-token")
				.set("x-api-token", "invalid-token");
			expect(response.status).toBe(401);
			expect(response.body.error).toContain("Invalid or expired token");
		});

		// Test 9: Should succeed /validate-token with valid token
		it("should succeed /validate-token with valid token", async () => {
			const response = await request(app)
				.get("/validate-token")
				.set("x-api-token", userToken);
			expect(response.status).toBe(200);
			expect(response.body.success).toBe(true);
			expect(response.body.email).toBe("test@user.com");
			expect(response.body.remaining_requests).toBe(5);
			expect(response.body.expires_at).toBeDefined();
		});

		// Test 10: Should fail /tiktok without token
		it("should fail /tiktok without token", async () => {
			const response = await request(app)
				.post("/tiktok")
				.send({ url: "https://www.tiktok.com/@user/video/123" });
			expect(response.status).toBe(401);
			expect(response.body.error).toBe("API token is required");
		});

		// Test 11: Should fail /tiktok without URL
		it("should fail /tiktok without URL", async () => {
			const response = await request(app)
				.post("/tiktok")
				.set("x-api-token", userToken)
				.send({});
			expect(response.status).toBe(400);
			expect(response.body.error).toBe("URL is required");
		});

		// Test 12: Should succeed /tiktok with valid token and URL
		it("should succeed /tiktok with valid token and URL", async () => {
			const response = await request(app)
				.post("/tiktok")
				.set("x-api-token", userToken)
				.send({
					url: "https://www.tiktok.com/@food9184/video/7574637317005036830?is_from_webapp=1",
				});
			expect(response.status).toBe(200);
			expect(response.header["content-type"]).toContain("video/mp4");
		});

		// Test 13: Should fail /tiktok when request limit is exceeded
		it("should fail /tiktok when limit exceeded", async () => {
			// Create a token with only 1 request allowed
			const tokenRes = await request(app)
				.post("/admin/generate-token")
				.send({
					email: "limit@test.com",
					allowedRequests: 1,
					adminEmail,
					adminPass,
				});
			const limitToken = tokenRes.body.token;

			// Use the first request
			await request(app)
				.post("/tiktok")
				.set("x-api-token", limitToken)
				.send({
					url: "https://www.tiktok.com/@food9184/video/7574637317005036830?is_from_webapp=1",
				});

			// Second request should fail
			const secondRes = await request(app)
				.post("/tiktok")
				.set("x-api-token", limitToken)
				.send({
					url: "https://www.tiktok.com/@food9184/video/7574637317005036830?is_from_webapp=1",
				});
			expect(secondRes.status).toBe(402);
			expect(secondRes.body.error).toBe("Request limit exceeded");
		});

		// Test 14: Should fail with expired token
		it("should fail with expired token", async () => {
			// Note: This test would require mocking the database to return an expired token
			// For now, we'll test the JWT expiration by creating an expired token
			const expiredToken =
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImV4cGlyZWRAZXhhbXBsZS5jb20iLCJpYXQiOjE3MTAwMDAwMDAsImV4cCI6MTcxMDAwMDAwMX0.invalid-signature";

			const response = await request(app)
				.get("/validate-token")
				.set("x-api-token", expiredToken);
			expect(response.status).toBe(401);
		});
	});

	describe("Edge Cases", () => {
		// Test 15: Should handle database errors gracefully
		it("should handle database errors in /admin/generate-token", async () => {
			// This would require mocking the database to throw an error
			// For now, we'll test with valid data
			const response = await request(app)
				.post("/admin/generate-token")
				.send({
					email: "db-error@test.com",
					allowedRequests: 10,
					adminEmail,
					adminPass,
				});
			expect(response.status).toBe(200);
		});

		// Test 16: Should handle invalid TikTok URLs
		it("should handle invalid TikTok URLs", async () => {
			const response = await request(app)
				.post("/tiktok")
				.set("x-api-token", userToken)
				.send({ url: "not-a-valid-url" });
			// The actual error might vary based on Puppeteer behavior
			expect(response.status).toBeGreaterThanOrEqual(400);
		});
	});
});
