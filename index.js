const express = require("express");
const puppeteer = require("puppeteer");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

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
 *                 example: "https://www.tiktok.com/@username/video/123456789"
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

	try {
		const browser = await puppeteer.launch({
			headless: false,
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
		});
		const page = await browser.newPage();

		await page.goto(url, { waitUntil: "networkidle2" });

		// Here you would implement the scraping logic
		// For example, extract video URL, title, etc.
		const data = await page.evaluate(() => {
			// TikTok specific scraping logic
			// This is a placeholder - actual implementation depends on TikTok's structure
			return {
				title: document.title,
				// Add more scraping logic here
			};
		});

		await browser.close();

		res.json({ success: true, data });
	} catch (error) {
		console.error("Scraping error:", error);
		res.status(500).json({ error: "Failed to scrape TikTok" });
	}
});

app.listen(PORT, () => {
	console.log(`Server running on port http://localhost:${PORT}`);
});
