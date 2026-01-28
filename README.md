# Social Media Helper API 🚀

A powerful and simplified API to download social media content, built with Puppeteer, Express, and Prisma (PostgreSQL).

> **Important Note:** This project is the result of a **Vibe Coding** session. It was developed rapidly using AI to prototype competitive ideas in record time.

## 🌟 Current Features
- **TikTok Scraper**: Video download support by simulating browser interactions.
- **Security**: JWT-based API tokens with request limits per user.
- **Persistence**: Token and user management using a PostgreSQL database.
- **Dockerized**: Production-ready configuration with Docker Compose.
- **Swagger Documentation**: Testing the API is as easy as opening your browser.

---

## ☁️ Hosted Access (No setup required)
If you don't want to deal with self-hosting, you can use our hosted API. 
To get an API token for our server, please reach out via X (Twitter):
- **Admin Contact**: [**@greggFlx**](https://x.com/greggFlx)

---

## 🛠️ Local Installation and Setup

### Prerequisites
- Node.js (v20+)
- `pnpm` (recommended)
- A PostgreSQL instance (or Docker installed)

### Steps to run locally:

1. **Clone the repository.**

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Configure the environment:**
   Copy the `.env.example` file to `.env` and fill in the variables:
   ```bash
   PORT=3000
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DATABASE"
   ADMIN_EMAIL="admin@example.com"
   ADMIN_PASS="your_secure_password"
   JWT_SECRET="a_very_long_secret"
   ```

4. **Prepare the database:**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. **Start the server:**
   ```bash
   pnpm start
   ```

---

## 🐳 Quick Start with Docker

If you have Docker installed, you can spin up the entire stack (API + PostgreSQL) with a single command:

1. Make sure your `.env` file is configured.
2. Run:
   ```bash
   docker-compose up --build
   ```

The API will be available at `http://localhost:${PORT}`.

---

## 📝 API Documentation

Once the server is running, you can access the interactive documentation at:
`http://localhost:3000/api-docs`

---

## 🚀 RoadMap (Future)
This project started as a download tool, but we plan to expand it into a full social media "Helper":
- [ ] Endpoint to fetch post comments.
- [ ] DM automation.
- [ ] Support for Instagram, X (Twitter), and YouTube.
- [ ] Sentiment analysis on comments.

---

## 🧪 Testing
To run the automated test suite:
```bash
pnpm test
```

---

Built with ❤️ after an intense Vibe Coding session. Constantly improving.