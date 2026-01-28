import express, { Request, Response, NextFunction } from "express";
import puppeteer, { Browser } from "puppeteer";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "./database";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASS = process.env.ADMIN_PASS!;

if (!JWT_SECRET || !ADMIN_EMAIL || !ADMIN_PASS) {
	console.error("Missing environment variables. Please check your .env file.");
	process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Extend Express Request type to include custom properties
export interface AuthRequest extends Request {
	userToken?: string;
	userEmail?: string;
	body: any;
	headers: any;
}

// Swagger options
const swaggerOptions = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "Social Media Helper API",
			version: "1.0.0",
			description:
				"API for downloading social media content with request limits. For hosted access, negotiate with @greggFlx on x.com.",
			contact: {
				name: "Admin (@greggFlx)",
				url: "https://x.com/greggFlx",
			},
		},
		components: {
			securitySchemes: {
				ApiKeyAuth: {
					type: "apiKey",
					in: "header",
					name: "x-api-token",
				},
			},
		},
	},
	apis: ["./index.ts"], // path to the API docs
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Authentication Middleware
const authenticateToken = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const token = req.header("x-api-token");

	if (!token) {
		res.status(401).json({
			error: "API token is required",
			help: "Please provide a valid token in the 'x-api-token' header. Contact admin to generate one.",
		});
		return;
	}

	try {
		// 1. Verify JWT signature and expiry (30 days)
		const decoded = jwt.verify(token, JWT_SECRET) as { email: string };

		// 2. Check database for request limits
		const tokenData = await db.getToken(token);

		if (!tokenData) {
			res.status(403).json({
				error: "Invalid or revoked token",
				help: "This token does not exist in our records.",
			});
			return;
		}

		console.log(`Remaining requests: ${tokenData.allowed_requests}`);
		if (tokenData.allowed_requests <= 0) {
			res.status(402).json({
				error: "Request limit exceeded",
				help: `You have used all allowed requests. Contact admin to increase your limit.`,
			});
			return;
		}

		// Attach user info to request
		req.userToken = token;
		req.userEmail = decoded.email;
		next();
	} catch (err: any) {
		res.status(401).json({
			error: "Invalid or expired token",
			details: err.message,
			help: "Tokens expire after 30 days. Please request a new one.",
		});
		return;
	}
};

/**
 * @swagger
 * /admin/generate-token:
 *   post:
 *     summary: Generate a limited API token (Admin only)
 *     description: Creates a 30-day token with a specific request limit. Requires admin credentials.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               allowedRequests:
 *                 type: integer
 *                 example: 50
 *               adminEmail:
 *                 type: string
 *               adminPass:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token generated successfully
 *       401:
 *         description: Unauthorized - Invalid admin credentials
 */
app.post(
	"/admin/generate-token",
	async (req: Request, res: Response): Promise<void> => {
		const { email, allowedRequests, adminEmail, adminPass } = req.body;

		if (adminEmail !== ADMIN_EMAIL || adminPass !== ADMIN_PASS) {
			res.status(401).json({ error: "Invalid admin credentials" });
			return;
		}

		if (!email || !allowedRequests) {
			res.status(400).json({ error: "Email and allowedRequests are required" });
			return;
		}

		// Generate 30-day JWT
		const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "30d" });

		// Store in DB
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 30);

		try {
			await db.saveToken(
				token,
				email,
				allowedRequests,
				expiresAt.toISOString()
			);
			res.json({
				success: true,
				token,
				expiresAt: expiresAt.toISOString(),
				allowedRequests,
			});
		} catch (error) {
			console.error("[Admin] Error generating token:", error);
			res.status(500).json({ error: "Failed to store token" });
		}
	}
);

/**
 * @swagger
 * /admin/tokens:
 *   post:
 *     summary: List all tokens (Admin only)
 *     description: Returns a list of all generated tokens and their usage. Requires admin credentials.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminEmail:
 *                 type: string
 *               adminPass:
 *                 type: string
 *     responses:
 *       200:
 *         description: List of tokens retrieved successfully
 */
app.post(
	"/admin/tokens",
	async (req: Request, res: Response): Promise<void> => {
		const { adminEmail, adminPass } = req.body;

		if (adminEmail !== ADMIN_EMAIL || adminPass !== ADMIN_PASS) {
			res.status(401).json({ error: "Invalid admin credentials" });
			return;
		}

		try {
			const tokens = await db.getAllTokens();
			res.json({ success: true, tokens });
		} catch (error) {
			console.error("[Admin] Error retrieving tokens:", error);
			res.status(500).json({ error: "Failed to retrieve tokens" });
		}
	}
);

/**
 * @swagger
 * /validate-token:
 *   get:
 *     summary: Validate your API token (User)
 *     description: Returns authentication status and request balance for the provided token.
 *     tags: [Utility]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Invalid or missing token
 */
app.get(
	"/validate-token",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		const tokenData = await db.getToken(req.userToken!);
		if (!tokenData) {
			res.status(404).json({ error: "Token data missing" });
			return;
		}

		res.json({
			success: true,
			email: tokenData.email,
			remaining_requests: tokenData.allowed_requests,
			expires_at: tokenData.expires_at,
		});
	}
);

/**
 * @swagger
 * /tiktok:
 *   post:
 *     summary: Scrape TikTok video data
 *     description: Extracts data from a TikTok URL using Puppeteer. Requires a valid API token.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: The TikTok video URL to scrape
 *                 example: "https://www.tiktok.com/@food9184/video/7574637317005036830?is_from_webapp=1"
 *             required:
 *               - url
 *     responses:
 *       200:
 *         description: Successful scraping
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: The title of the TikTok video
 *                       example: "Funny TikTok Video"
 *       400:
 *         description: Bad request - URL is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "URL is required"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to scrape TikTok"
 */
app.post(
	"/tiktok",
	authenticateToken,
	async (req: AuthRequest, res: Response): Promise<void> => {
		const url = req.body.url;

		if (!url) {
			res.status(400).json({ error: "URL is required" });
			return;
		}

		let browser: Browser | undefined;
		try {
			console.log(
				`[TikTok] Launching browser (headless: ${process.env.NODE_ENV === "production"})`
			);
			browser = await puppeteer.launch({
				headless: process.env.NODE_ENV === "production",
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});
			const page = await browser.newPage();

			const downloadDir = path.resolve(process.cwd(), "downloads");
			if (!fs.existsSync(downloadDir)) {
				console.log(`[TikTok] Creating downloads directory at ${downloadDir}`);
				fs.mkdirSync(downloadDir, { recursive: true });
			}

			console.log("[TikTok] Configuring download behavior...");
			const client = await page.target().createCDPSession();
			await client.send("Browser.setDownloadBehavior", {
				behavior: "allow",
				downloadPath: downloadDir,
			});

			console.log(`[TikTok] Navigating to: ${url}`);
			await page.goto(url, { waitUntil: "networkidle2" });

			// Wait for the player container
			const containerSelector = ".xgplayer-container.tiktok-web-player";
			console.log("[TikTok] Waiting for player container...");
			await page.waitForSelector(containerSelector, { timeout: 15000 });
			console.log("[TikTok] Player container found");

			// Scroll into view and ensure it's visible
			console.log("[TikTok] Scrolling player into view...");
			await page.evaluate(sel => {
				const el = document.querySelector(sel);
				if (el) {
					el.scrollIntoView({ block: "center" });
				}
			}, containerSelector);
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Get video element or its wrapper
			const rect = await page.evaluate(sel => {
				const el = document.querySelector(sel);
				if (!el) return null;
				const box = el.getBoundingClientRect();
				return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
			}, containerSelector);

			if (!rect) {
				throw new Error("Could not find player container coordinates");
			}

			console.log(
				`[TikTok] Right-clicking player at coordinates: ${rect.x}, ${rect.y}`
			);
			await page.mouse.click(rect.x, rect.y, { button: "right" });

			// Wait for the Download video option in the UL popup
			const downloadOptionSelector = "::-p-text(Download video)";
			console.log("[TikTok] Searching for 'Download video' option...");
			try {
				await page.waitForSelector(downloadOptionSelector, { timeout: 8000 });
				console.log("[TikTok] Download option located.");
			} catch (e) {
				console.log("[TikTok] Strict search failed, trying fallback XPath...");
				const fallbackSelector =
					"xpath///*[contains(text(), 'Download video')]";
				await page.waitForSelector(fallbackSelector, { timeout: 5000 });
			}

			const downloadOption =
				(await page.$(downloadOptionSelector)) ||
				(await page.$("xpath///*[contains(text(), 'Download video')]"));

			if (!downloadOption) {
				throw new Error("Could not find download option element");
			}

			console.log("[TikTok] Triggering download via JS click...");
			await page.evaluate(el => {
				if (el) (el as HTMLElement).click();
			}, downloadOption);

			// Wait for the download to complete
			console.log("[TikTok] Monitoring downloads folder for new file...");

			interface FileInfo {
				name: string;
				time: number;
			}

			const getLatestFile = (): FileInfo | undefined => {
				const files = fs.readdirSync(downloadDir);
				return files
					.map(file => ({
						name: file,
						time: fs.statSync(path.join(downloadDir, file)).mtime.getTime(),
					}))
					.sort((a, b) => b.time - a.time)[0];
			};

			const initialLatest = getLatestFile();

			// Poll for a new file for up to 30 seconds
			let downloadedFile: string | null = null;
			for (let i = 0; i < 60; i++) {
				await new Promise(resolve => setTimeout(resolve, 500));
				const currentLatest = getLatestFile();
				if (
					currentLatest &&
					(!initialLatest || currentLatest.time > initialLatest.time)
				) {
					// Check if it's not a temp file (like .crdownload)
					if (
						!currentLatest.name.endsWith(".crdownload") &&
						!currentLatest.name.endsWith(".tmp")
					) {
						downloadedFile = path.join(downloadDir, currentLatest.name);
						console.log(`[TikTok] New file detected: ${currentLatest.name}`);
						break;
					}
				}
			}

			if (!downloadedFile) {
				throw new Error("Download timed out after 30 seconds");
			}

			console.log(`[TikTok] Download complete: ${downloadedFile}`);

			// Return the video and link if possible
			const videoSrc = await page.evaluate(() => {
				const video = document.querySelector("video");
				return video ? video.src : null;
			});

			if (videoSrc) {
				console.log(`[TikTok] Original video source found: ${videoSrc}`);
			}

			console.log(`[TikTok] Streaming file to client...`);
			res.download(downloadedFile, async err => {
				if (err) {
					console.error("[TikTok] Error sending file:", err);
				} else {
					console.log("[TikTok] File sent successfully. Incrementing usage...");
					await db.incrementUsage(req.userToken!);
					console.log("[TikTok] Usage incremented. Cleaning up...");
				}
				// Cleanup
				if (downloadedFile && fs.existsSync(downloadedFile)) {
					fs.unlinkSync(downloadedFile);
					console.log("[TikTok] Temporary file deleted.");
				}
			});

			await browser.close();
			console.log("[TikTok] Browser closed. Process finished.");
		} catch (error: any) {
			console.error("[TikTok] Scraping error:", error);
			if (browser) await browser.close();
			res
				.status(500)
				.json({ error: "Failed to scrape TikTok", details: error.message });
		}
	}
);

if (process.env.NODE_ENV !== "test") {
	app.listen(PORT, () => {
		console.log(
			`Server running on port http://localhost:${PORT} | look at the docs at http://localhost:${PORT}/api-docs`
		);
	});
}
export { app };
