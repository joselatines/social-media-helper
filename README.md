# Social Media Downloader API 🚀

A powerful and simplified API to download social media content, built with Puppeteer and Express. Currently optimized for high-performance TikTok video scraping.

## 🌟 Features
- **TikTok Scraper**: Full video download support via context-menu interaction.
- **Security**: JWT-based API tokens with request limits.
- **Persistence**: Usage tracking via local JSON data.
- **Dockerized**: Ready to deploy with Docker and Docker Compose.
- **Swagger Documentation**: Interactive API testing out of the box.

---

## 🛠️ Usage Options

### 1. ☁️ Use Our Hosted Version (Freemium/Paid)
If you don't want to manage your own server, you can use our hosted API. 
To get an API token, you need to negotiate with the administrator:

- **Admin Contact**: Reach out via X (formerly Twitter) to [**@greggFlx**](https://x.com/greggFlx).
- **Pricing**: Flexible plans based on request credits.

### 2. 🏠 Self-Hosting (For Technical Users)
You can easily host this API on your own infrastructure.

#### Prerequisites
- Node.js (v20+) or Docker.
- `pnpm` (recommended).

#### Quick Start (Native)
1. Clone the repo.
2. Install dependencies: `pnpm install`
3. Configure your `.env` (use `.env.example` as a template).
4. Start the server: `pnpm start`

#### Quick Start (Docker)
1. Configure your `.env`.
2. Run: `docker-compose up --build`

---

## 🔒 Security Configuration
Ensure you set the following in your `.env`:
- `ADMIN_EMAIL` & `ADMIN_PASS`: For generating user tokens.
- `JWT_SECRET`: A long random string to sign tokens.

To generate a token for a user:
`POST /generate-api-token` with the admin credentials in the body.

---

## 🧪 Testing
Run the automated test suite to verify everything is working:
```bash
pnpm test
```

---

## 📝 API Documentation
Once the server is running, visit:
`http://localhost:3000/api-docs`

---

Built with ❤️ by [Jose](https://github.com/joselatines) and IA jeje.