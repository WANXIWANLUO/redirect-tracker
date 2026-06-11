import express from 'express';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { trackRedirects } from './tracker.js';

// 全局容忍非标准 HTTP 响应（缺 CR 等）
http.globalAgent.insecureHTTPParser = true;
https.globalAgent.insecureHTTPParser = true;

// Monkey-patch: 确保所有 http/https 请求都启用宽松解析
const _origHttpReq = http.request.bind(http);
const _origHttpsReq = https.request.bind(https);
http.request = function (opts, cb) {
  if (typeof opts === 'object' && opts !== null && !opts._patched) {
    opts = { ...opts, insecureHTTPParser: true, _patched: true };
  }
  return _origHttpReq(opts, cb);
};
https.request = function (opts, cb) {
  if (typeof opts === 'object' && opts !== null && !opts._patched) {
    opts = { ...opts, insecureHTTPParser: true, _patched: true };
  }
  return _origHttpsReq(opts, cb);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Helper: create proxy agent
function createProxyAgent(proxy) {
  const auth = proxy.username ? `${proxy.username}:${proxy.password || ''}@` : '';
  if (proxy.type === 'socks5') {
    return new SocksProxyAgent(`socks5://${auth}${proxy.host}:${proxy.port}`, { keepAlive: true, insecureHTTPParser: true });
  }
  const protocol = proxy.type === 'https' ? 'https' : 'http';
  return new HttpsProxyAgent(`${protocol}://${auth}${proxy.host}:${proxy.port}`, { keepAlive: true, insecureHTTPParser: true });
}

// API: Check IP (through proxy)
app.post('/api/check-ip', async (req, res) => {
  try {
    const { proxy } = req.body;
    const axiosConfig = {
      url: 'http://ip-api.com/json/?fields=status,country,countryCode,query',
      method: 'GET',
      timeout: 10000,
      insecureHTTPParser: true,
    };
    if (proxy) {
      const agent = createProxyAgent(proxy);
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
    }
    const response = await axios(axiosConfig);
    res.json({ success: true, result: response.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'IP 检查失败',
    });
  }
});

// API: Track URL redirects (SSE streaming)
app.post('/api/track', async (req, res) => {
  try {
    const { url, proxy, userAgent, forceParams, forceHeaders } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: '请提供 URL' });
    }

    // Validate URL format
    try {
      const testUrl = url.startsWith('http') ? url : `http://${url}`;
      new URL(testUrl);
    } catch {
      return res.status(400).json({ success: false, error: 'URL 格式无效' });
    }

    const result = await trackRedirects(url, proxy || null, userAgent || null, forceParams || null, forceHeaders || null);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Track error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '追踪失败',
    });
  }
});

// Serve static files in production
const clientDist = path.join(__dirname, '..', 'dist', 'client');
app.use(express.static(clientDist));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('请先运行 npm run build 构建前端');
    }
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   🔗 URL 重定向追踪器 已启动             ║');
  console.log(`  ║   http://localhost:${PORT}                  ║`);
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
