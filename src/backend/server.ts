import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { setupHelmet, globalLimiter } from './middleware/security.ts';
import { initDb } from './utils/db.ts';
import { seedAdmin } from './utils/seed.ts';

// Environment Variablen laden
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render/Cloudflare (wichtig für rate limiting)
app.set('trust proxy', 1);

// Datenbank Initialisierung
initDb();
seedAdmin().catch(console.error);

// --- MIDDLEWARES (Reihenfolge ist wichtig!) ---

// 1. Debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 2. Security Headers & Rate Limiting (frühzeitig schützen)
app.use(setupHelmet());
app.use(globalLimiter);

// 3. Request Parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// --- ROUTES ---

// Auth Routes (Mounten NACH den Middlewares)
// Auth Routes (Mounten NACH den Middlewares)
import authRoutes from './routes/authRoutes.ts';
import { authenticateJWT } from './middleware/authMiddleware.ts';
import productRoutes from './routes/productRoutes.ts';
import shopRoutes from './routes/shopRoutes.ts';
import orderRoutes from './routes/orderRoutes.ts'; // Import

app.use('/api/admin', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/admin/orders', orderRoutes); // Mount Orders API

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Statische Dateien (Frontend)
app.use(express.static(path.resolve('public')));
app.use('/assets', express.static(path.resolve('src/frontend')));
app.use('/js', express.static(path.resolve('src/frontend/js'))); // Serve JS at /js
app.use('/css', express.static(path.resolve('src/frontend/css'))); // Serve CSS at /css

app.get('/admin', authenticateJWT, (req, res) => {
  res.sendFile(path.resolve('src/frontend/dashboard.html'));
});
app.get('/admin/login', (req, res) => {
  res.sendFile(path.resolve('src/frontend/login.html'));
});
app.get('/admin/dashboard', authenticateJWT, (req, res) => {
  res.sendFile(path.resolve('src/frontend/dashboard.html'));
});
app.get('/admin/orders', authenticateJWT, (req, res) => {
  res.sendFile(path.resolve('src/frontend/dashboard.html'));
});

// Serve Public Shop Pages
app.get('/', (req, res) => {
  res.sendFile(path.resolve('src/frontend/index.html'));
});
app.get('/checkout.html', (req, res) => {
  res.sendFile(path.resolve('src/frontend/checkout.html'));
});
app.get('/agb.html', (req, res) => {
  res.sendFile(path.resolve('src/frontend/agb.html'));
});
app.get('/datenschutz.html', (req, res) => {
  res.sendFile(path.resolve('src/frontend/datenschutz.html'));
});
app.get('/impressum.html', (req, res) => {
  res.sendFile(path.resolve('src/frontend/impressum.html'));
});
app.get('/thank-you.html', (req, res) => {
  res.sendFile(path.resolve('src/frontend/thank-you.html'));
});

// Fallback for other routes (404 handling could be added here)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Server Start
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
