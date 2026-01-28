const express = require("express");
const puppeteer = require("puppeteer");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Swagger options
const swaggerOptions = {
	definition: {
		openapi: "3.0.0",
		info: {
			title: "Social Media Downloader API",
			version: "1.0.0",
			description: "API for downloading social media content",
		},
	},
	apis: ["./index.js"], // path to the API docs
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /tiktok:
 *   post:
 *     summary: Scrape TikTok video data
 *     description: Extracts data from a TikTok URL using Puppeteer
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
app.post("/tiktok", async (req, res) => {
	console.log(req.body);
	const url = req.body.url;

	if (!url) {
		return res.status(400).json({ error: "URL is required" });
	}

	let browser;
	try {
		console.log(`[TikTok] Launching browser (headless: ${process.env.NODE_ENV === "production"})`);
		browser = await puppeteer.launch({
			headless: process.env.NODE_ENV === "production",
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
		const page = await browser.newPage();

		const downloadDir = path.resolve(__dirname, "downloads");
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
		await page.evaluate((sel) => {
			const el = document.querySelector(sel);
			if (el) {
				el.scrollIntoView({ block: "center" });
			}
		}, containerSelector);
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Get video element or its wrapper
		const rect = await page.evaluate((sel) => {
			const el = document.querySelector(sel);
			if (!el) return null;
			const box = el.getBoundingClientRect();
			return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
		}, containerSelector);

		if (!rect) {
			throw new Error("Could not find player container coordinates");
		}

		console.log(`[TikTok] Right-clicking player at coordinates: ${rect.x}, ${rect.y}`);
		await page.mouse.click(rect.x, rect.y, { button: "right" });

		// Wait for the Download video option in the UL popup
		const downloadOptionSelector = "::-p-text(Download video)";
		console.log("[TikTok] Searching for 'Download video' option...");
		try {
			await page.waitForSelector(downloadOptionSelector, { timeout: 8000 });
			console.log("[TikTok] Download option located.");
		} catch (e) {
			console.log("[TikTok] Strict search failed, trying fallback XPath...");
			const fallbackSelector = "xpath///*[contains(text(), 'Download video')]";
			await page.waitForSelector(fallbackSelector, { timeout: 5000 });
		}

		const downloadOption = (await page.$(downloadOptionSelector)) || (await page.$("xpath///*[contains(text(), 'Download video')]"));

		if (!downloadOption) {
			throw new Error("Could not find download option element");
		}

		console.log("[TikTok] Triggering download via JS click...");
		await page.evaluate((el) => {
			if (el) el.click();
		}, downloadOption);

		// Wait for the download to complete
		console.log("[TikTok] Monitoring downloads folder for new file...");

		const getLatestFile = () => {
			const files = fs.readdirSync(downloadDir);
			return files
				.map(file => ({ name: file, time: fs.statSync(path.join(downloadDir, file)).mtime.getTime() }))
				.sort((a, b) => b.time - a.time)[0];
		};

		const initialLatest = getLatestFile();
		
		// Poll for a new file for up to 30 seconds
		let downloadedFile = null;
		for (let i = 0; i < 60; i++) {
			await new Promise(resolve => setTimeout(resolve, 500));
			const currentLatest = getLatestFile();
			if (currentLatest && (!initialLatest || currentLatest.time > initialLatest.time)) {
				// Check if it's not a temp file (like .crdownload)
				if (!currentLatest.name.endsWith(".crdownload") && !currentLatest.name.endsWith(".tmp")) {
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
		res.download(downloadedFile, (err) => {
			if (err) {
				console.error("[TikTok] Error sending file:", err);
			} else {
				console.log("[TikTok] File sent successfully. Cleaning up...");
			}
			// Cleanup
			if (fs.existsSync(downloadedFile)) {
				fs.unlinkSync(downloadedFile);
				console.log("[TikTok] Temporary file deleted.");
			}
		});

		await browser.close();
		console.log("[TikTok] Browser closed. Process finished.");
	} catch (error) {
		console.error("[TikTok] Scraping error:", error);
		if (browser) await browser.close();
		res.status(500).json({ error: "Failed to scrape TikTok", details: error.message });
	}
});

app.listen(PORT, () => {
	console.log(`Server running on port http://localhost:${PORT} | look at the docs at http://localhost:${PORT}/api-docs`);
});
