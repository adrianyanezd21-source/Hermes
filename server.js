import express from 'express';
import session from 'express-session';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import config from './src/config.js';
import { checkPassword, issueCsrf } from './src/auth.js';
import hermes from './src/hermes.js';
import chat from './src/chat.js';
import { apiRouter } from './src/routes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

const sessionParser = session({
  name: 'hermes.sid',
  secret: config.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 12,
  },
});
app.use(sessionParser);

// Cabeceras de seguridad básicas + CSP (sin unsafe-eval).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net blob:",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
      "worker-src 'self' blob:",
      "font-src 'self' https://cdn.jsdelivr.net",
    ].join('; ')
  );
  next();
});

// -------- Autenticación --------
app.post('/auth/login', (req, res) => {
  const { password } = req.body || {};
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'contraseña incorrecta' });
  }
  req.session.authed = true;
  const csrf = issueCsrf(req);
  res.json({ ok: true, csrf });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/auth/me', (req, res) => {
  if (req.session?.authed) {
    return res.json({ authed: true, csrf: issueCsrf(req) });
  }
  res.json({ authed: false });
});

// -------- API --------
app.use('/api', apiRouter());

// -------- Estáticos (frontend) --------
app.use(express.static(config.publicDir));
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: config.publicDir });
});

// -------- Servidor HTTP + WebSocket (chat) --------
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  sessionParser(request, {}, () => {
    if (!request.session?.authed) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'chat' && msg.prompt) {
      ws.send(JSON.stringify({ type: 'start' }));
      chat.stream(msg.prompt, msg.profile, {
        onChunk: (chunk) => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'chunk', text: chunk })),
        onDone: () => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'done' })),
        onError: (err) => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'error', error: err.message })),
      });
    }
  });
});

server.listen(config.port, async () => {
  const mode = await hermes.mode();
  console.log('━'.repeat(54));
  console.log('  Hermes Control Panel');
  console.log(`  → http://localhost:${config.port}`);
  console.log(`  Modo: ${mode === 'live' ? 'LIVE (CLI de Hermes detectado)' : 'DEMO (sin CLI de Hermes)'}`);
  console.log('━'.repeat(54));
});
