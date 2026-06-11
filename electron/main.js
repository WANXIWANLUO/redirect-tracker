const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { trackRedirects } = require('./tracker');

// ===== 全局容忍非标准 HTTP 响应 =====
http.globalAgent.insecureHTTPParser = true;
https.globalAgent.insecureHTTPParser = true;

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

// ===== 代理 Agent 工厂 =====
function createProxyAgent(proxy) {
  const auth = proxy.username ? `${proxy.username}:${proxy.password || ''}@` : '';
  if (proxy.type === 'socks5') {
    return new SocksProxyAgent(`socks5://${auth}${proxy.host}:${proxy.port}`, { keepAlive: true, insecureHTTPParser: true });
  }
  const protocol = proxy.type === 'https' ? 'https' : 'http';
  return new HttpsProxyAgent(`${protocol}://${auth}${proxy.host}:${proxy.port}`, { keepAlive: true, insecureHTTPParser: true });
}

// ===== IPC 处理器 =====

// IP 检查
ipcMain.handle('check-ip', async (_event, { proxy }) => {
  try {
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
    return { success: true, result: response.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'IP 检查失败',
    };
  }
});

// URL 追踪
ipcMain.handle('track', async (_event, { url, proxy, userAgent, forceParams, forceHeaders }) => {
  try {
    if (!url) {
      return { success: false, error: '请提供 URL' };
    }
    // Validate URL format
    try {
      const testUrl = url.startsWith('http') ? url : `http://${url}`;
      new URL(testUrl);
    } catch {
      return { success: false, error: 'URL 格式无效' };
    }

    const result = await trackRedirects(url, proxy || null, userAgent || null, forceParams || null, forceHeaders || null);
    return { success: true, result };
  } catch (error) {
    console.error('Track error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '追踪失败',
    };
  }
});

// ===== 窗口创建 =====
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'URL 重定向追踪器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式：从 Vite 开发服务器加载
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // 生产模式：加载构建产物
    win.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }

  // 屏蔽窗口标题更新
  win.on('page-title-updated', (e) => e.preventDefault());
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // 去掉菜单栏
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
