import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLiteStore = connectSqlite3(session);
const dbPath = path.join(__dirname, "rex.db");
const db = new Database(dbPath);

console.log(`[DB] Using database at: ${dbPath}`);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    streak_count INTEGER DEFAULT 0,
    last_activity_date TEXT,
    healing_percentage INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS completed_missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    mission_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    messages TEXT,
    verdict TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    result TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    code TEXT,
    expires_at DATETIME,
    used INTEGER DEFAULT 0
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(
    session({
      store: new SQLiteStore({ db: "sessions.db", dir: "." }) as any,
      secret: "rex-secret-key-brutal-honesty",
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
      rolling: true
    })
  );

  // Auth Routes
  app.post("/api/signup", async (req, res) => {
    const { email: rawEmail, password, name } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    console.log(`[AUTH] Signup attempt for: ${email}`);
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const info = db.prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run(email, hashedPassword, name);
      const user = db.prepare("SELECT id, email, name, streak_count, healing_percentage FROM users WHERE id = ?").get(info.lastInsertRowid) as any;
      (req.session as any).userId = user.id;
      console.log(`[AUTH] Signup successful for: ${email} (ID: ${user.id})`);
      res.json({ user });
    } catch (error: any) {
      console.error(`[AUTH] Signup error for ${email}:`, error);
      if (error.code === "SQLITE_CONSTRAINT") {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(500).json({ error: "Server error" });
      }
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email: rawEmail, password } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    console.log(`[AUTH] Login attempt for: ${email}`);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (user && (await bcrypt.compare(password, user.password))) {
      (req.session as any).userId = user.id;
      console.log(`[AUTH] Login successful for: ${email}`);
      res.json({ user: { id: user.id, email: user.email, name: user.name, streak_count: user.streak_count, healing_percentage: user.healing_percentage } });
    } else {
      console.log(`[AUTH] Login failed for: ${email}`);
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.post("/api/forgot-password", async (req, res) => {
    const { email: rawEmail } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    console.log(`[AUTH] Forgot password request for: ${email}`);
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    
    if (!user) {
      console.log(`[AUTH] Forgot password failed: User ${email} not found`);
      return res.status(404).json({ error: "User not found" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    db.prepare("INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)").run(email, code, expiresAt);
    console.log(`[AUTH] Generated code ${code} for ${email}`);

    try {
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        throw new Error("Gmail credentials not configured");
      }

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      console.log(`[AUTH] Attempting to send email to ${email} via Gmail`);
      await transporter.sendMail({
        from: `"TherapEX" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Your Password Reset Code",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; background-color: #0a0a0a; border-radius: 20px;">
            <h2 style="color: #ff4757;">Password Reset Request</h2>
            <p style="color: #ffffff;">You requested a password reset for your TherapEX account.</p>
            <p style="color: #ffffff;">Your verification code is:</p>
            <h1 style="color: #ff4757; font-size: 32px; letter-spacing: 5px; background: rgba(255,71,87,0.1); padding: 15px; border-radius: 10px; text-align: center;">${code}</h1>
            <p style="color: #ffffff; opacity: 0.6; font-size: 12px;">This code will expire in 15 minutes.</p>
            <p style="color: #ffffff; opacity: 0.6; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });

      console.log(`[AUTH] Email sent successfully to ${email}`);
      res.json({ success: true, message: "Verification code sent to email" });
    } catch (error) {
      console.error("[AUTH] Email sending failed, falling back to demo mode:", error);
      // Fallback for demo: provide the code in the response so the user isn't blocked
      res.json({ 
        success: true, 
        message: "Email service not configured or failed. [DEMO MODE]", 
        demoCode: code 
      });
    }
  });

  app.post("/api/verify-code", (req, res) => {
    const { email: rawEmail, code } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    console.log(`[AUTH] Verifying code ${code} for ${email}`);
    const record = db.prepare("SELECT * FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?").get(email, code, new Date().toISOString()) as any;
    
    if (record) {
      console.log(`[AUTH] Code verification successful for ${email}`);
      res.json({ success: true });
    } else {
      console.log(`[AUTH] Code verification failed for ${email}`);
      res.status(400).json({ error: "Invalid or expired code" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    const { email: rawEmail, code, newPassword } = req.body;
    const email = rawEmail?.trim().toLowerCase();
    console.log(`[AUTH] Resetting password for ${email}`);
    const record = db.prepare("SELECT * FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?").get(email, code, new Date().toISOString()) as any;
    
    if (!record) {
      console.log(`[AUTH] Password reset failed: Invalid code for ${email}`);
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hashedPassword, email);
      db.prepare("UPDATE verification_codes SET used = 1 WHERE id = ?").run(record.id);
      console.log(`[AUTH] Password reset successful for ${email}`);
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error(`[AUTH] Password reset error for ${email}:`, error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/me", (req, res) => {
    const userId = (req.session as any).userId;
    if (userId) {
      const user = db.prepare("SELECT id, email, name, streak_count, healing_percentage, last_activity_date FROM users WHERE id = ?").get(userId) as any;
      res.json({ user });
    } else {
      res.json({ user: null });
    }
  });

  // Gym Routes
  app.post("/api/complete-mission", (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
      
      const { missionId } = req.body;
      const today = new Date().toISOString().split('T')[0];
      
      // Check if mission already completed today
      const existing = db.prepare("SELECT id FROM completed_missions WHERE user_id = ? AND mission_id = ? AND date(timestamp) = date('now')").get(userId, missionId);
      if (existing) return res.status(400).json({ error: "Mission already completed today" });

      // Save completion
      db.prepare("INSERT INTO completed_missions (user_id, mission_id) VALUES (?, ?)").run(userId, missionId);

      // Update streak and healing percentage
      const user = db.prepare("SELECT streak_count, last_activity_date, healing_percentage FROM users WHERE id = ?").get(userId) as any;
      let newStreak = user.streak_count;
      const lastDate = user.last_activity_date;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Only increment streak if we haven't already done something today
      if (lastDate !== today) {
        if (!lastDate) {
          newStreak = 1;
        } else if (lastDate === yesterdayStr) {
          newStreak += 1;
        } else {
          // It was older than yesterday, so reset to 1
          newStreak = 1;
        }
      }

      const newPercentage = Math.min(100, user.healing_percentage + 1);
      db.prepare("UPDATE users SET streak_count = ?, last_activity_date = ?, healing_percentage = ? WHERE id = ?").run(newStreak, today, newPercentage, userId);

      res.json({ success: true, streak: newStreak, percentage: newPercentage });
    } catch (error) {
      console.error("Mission Error:", error);
      res.status(500).json({ error: "Failed to save progress." });
    }
  });

  app.get("/api/gym-status", (req, res) => {
    const userId = (req.session as any).userId;
    if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });

    const completedToday = db.prepare("SELECT mission_id FROM completed_missions WHERE user_id = ? AND date(timestamp) = date('now')").all(userId);
    res.json({ completedMissions: completedToday.map((m: any) => m.mission_id) });
  });

  // Data Routes
  app.post("/api/save-chat", (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
      
      const { id, messages, verdict } = req.body;
      
      // Memory & Error Management: Limit chat size to prevent DB bloat and performance issues
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      // Limit to 100 messages per chat session
      const limitedMessages = messages.slice(-100);
      const messagesJson = JSON.stringify(limitedMessages);

      // Max size check (approx 500KB)
      if (messagesJson.length > 500000) {
        return res.status(413).json({ error: "Chat history too large" });
      }
      
      if (id) {
        db.prepare("UPDATE chats SET messages = ?, verdict = ? WHERE id = ? AND user_id = ?").run(messagesJson, verdict, id, userId);
        res.json({ success: true, id });
      } else {
        const info = db.prepare("INSERT INTO chats (user_id, messages, verdict) VALUES (?, ?, ?)").run(userId, messagesJson, verdict);
        res.json({ success: true, id: info.lastInsertRowid });
      }
    } catch (error) {
      console.error("Save Chat Error:", error);
      res.status(500).json({ error: "Failed to save chat history." });
    }
  });

  app.delete("/api/delete-chat/:id", (req, res) => {
    const userId = (req.session as any).userId;
    if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    db.prepare("DELETE FROM chats WHERE id = ? AND user_id = ?").run(id, userId);
    res.json({ success: true });
  });

  app.get("/api/get-chats", (req, res) => {
    try {
      const userId = (req.session as any).userId;
      console.log(`[GET /api/get-chats] userId: ${userId}`);
      if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
      const chats = db.prepare("SELECT * FROM chats WHERE user_id = ? ORDER BY timestamp DESC").all(userId);
      res.json({ chats: chats.map((c: any) => ({ ...c, messages: JSON.parse(c.messages) })) });
    } catch (error) {
      console.error("Get Chats Error:", error);
      res.status(500).json({ error: "Failed to fetch chats." });
    }
  });

  app.post("/api/save-quiz", (req, res) => {
    const userId = (req.session as any).userId;
    if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
    const { id, result } = req.body;
    
    if (id) {
      db.prepare("UPDATE quiz_results SET result = ? WHERE id = ? AND user_id = ?").run(JSON.stringify(result), id, userId);
      res.json({ success: true, id });
    } else {
      const info = db.prepare("INSERT INTO quiz_results (user_id, result) VALUES (?, ?)").run(userId, JSON.stringify(result));
      res.json({ success: true, id: info.lastInsertRowid });
    }
  });

  app.delete("/api/delete-quiz/:id", (req, res) => {
    const userId = (req.session as any).userId;
    if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    db.prepare("DELETE FROM quiz_results WHERE id = ? AND user_id = ?").run(id, userId);
    res.json({ success: true });
  });

  app.get("/api/get-quizzes", (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (userId === undefined || userId === null) return res.status(401).json({ error: "Unauthorized" });
      const results = db.prepare("SELECT * FROM quiz_results WHERE user_id = ? ORDER BY timestamp DESC").all(userId);
      res.json({ results: results.map((r: any) => ({ ...r, result: JSON.parse(r.result) })) });
    } catch (error) {
      console.error("Get Quizzes Error:", error);
      res.status(500).json({ error: "Failed to fetch quizzes." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    console.log(`[DB] Initialized. User count: ${userCount.count}`);
  });
}

startServer();
