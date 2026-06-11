const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const FILE_EXTENSIONS = [
  '.exe', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp3', '.mp4', '.avi', '.mkv', '.mov', '.flv',
  '.iso', '.dmg', '.msi', '.deb', '.rpm',
  '.apk', '.ipa', '.war', '.jar',
];

const MAX_BODY_SIZE = 200 * 1024; // 200KB max body capture

function isFileDownloadUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const path = pathname.split('?')[0];
    return FILE_EXTENSIONS.some(ext => path.endsWith(ext));
  } catch {
    return false;
  }
}

function isFileDownloadHeader(headers) {
  const cd = headers['content-disposition'] || '';
  if (typeof cd === 'string' && cd.toLowerCase().includes('attachment')) return true;
  return false;
}

function hasProtocolChanged(originalUrl, redirectUrl) {
  try {
    const origProto = new URL(originalUrl).protocol;
    const redirProto = new URL(redirectUrl).protocol;
    if (['http:', 'https:'].includes(redirProto)) return false;
    return origProto !== redirProto;
  } catch {
    return false;
  }
}

function isHtmlContent(headers) {
  const ct = (headers['content-type'] || '').toLowerCase();
  return ct.includes('text/html') || ct.includes('application/xhtml');
}

/**
 * Parse HTML for meta refresh and JavaScript redirects
 */
function parseHtmlRedirects(html, baseUrl) {
  const redirects = [];

  // 1. <meta http-equiv="refresh" content="0;url=...">
  const metaRegex = /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["']?\s*(\d+)\s*;\s*url\s*=\s*([^"'\s>]+)["']?[^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const delay = parseInt(match[1]) || 0;
    let targetUrl = match[2].trim().replace(/^['"]|['"]$/g, '');
    try {
      targetUrl = new URL(targetUrl, baseUrl).href;
    } catch {}
    redirects.push({
      type: 'meta-refresh',
      delay,
      url: targetUrl,
      description: `<meta http-equiv="refresh"> 延迟 ${delay}s`,
    });
  }

  // Also try reversed attribute order: content before http-equiv
  const metaRegex2 = /<meta[^>]+content\s*=\s*["']?\s*(\d+)\s*;\s*url\s*=\s*([^"'\s>]+)["']?[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi;
  while ((match = metaRegex2.exec(html)) !== null) {
    const delay = parseInt(match[1]) || 0;
    let targetUrl = match[2].trim().replace(/^['"]|['"]$/g, '');
    try {
      targetUrl = new URL(targetUrl, baseUrl).href;
    } catch {}
    redirects.push({
      type: 'meta-refresh',
      delay,
      url: targetUrl,
      description: `<meta http-equiv="refresh"> 延迟 ${delay}s`,
    });
  }

  // 2. window.location = "..." / window.location.href = "..."
  const jsPatterns = [
    { regex: /window\.location\.href\s*=\s*["']([^"']+)["']/gi, desc: 'window.location.href' },
    { regex: /window\.location\s*=\s*["']([^"']+)["']/gi, desc: 'window.location' },
    { regex: /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/gi, desc: 'window.location.replace' },
    { regex: /window\.location\.assign\s*\(\s*["']([^"']+)["']\s*\)/gi, desc: 'window.location.assign' },
    { regex: /location\.href\s*=\s*["']([^"']+)["']/gi, desc: 'location.href' },
    { regex: /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/gi, desc: 'location.replace' },
    { regex: /location\.assign\s*\(\s*["']([^"']+)["']\s*\)/gi, desc: 'location.assign' },
    { regex: /location\s*=\s*["']([^"']+)["']/gi, desc: 'location =' },
  ];

  for (const { regex, desc } of jsPatterns) {
    while ((match = regex.exec(html)) !== null) {
      let targetUrl = match[1].trim();
      try {
        targetUrl = new URL(targetUrl, baseUrl).href;
      } catch {}
      // Avoid duplicates
      if (!redirects.some(r => r.url === targetUrl && r.type === 'javascript')) {
        redirects.push({
          type: 'javascript',
          delay: 0,
          url: targetUrl,
          description: `${desc} (JS 跳转)`,
        });
      }
    }
  }

  // 3. <script> with setTimeout + location
  const setTimeoutRegex = /setTimeout\s*\(\s*function\s*\(\s*\)\s*\{[^}]*location[^}]*\}[^,]*,\s*(\d+)/gi;
  while ((match = setTimeoutRegex.exec(html)) !== null) {
    const delay = parseInt(match[1]) / 1000; // ms to seconds
    const innerMatch = match[0].match(/location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
    if (innerMatch) {
      let targetUrl = innerMatch[1].trim();
      try {
        targetUrl = new URL(targetUrl, baseUrl).href;
      } catch {}
      if (!redirects.some(r => r.url === targetUrl)) {
        redirects.push({
          type: 'javascript',
          delay,
          url: targetUrl,
          description: `setTimeout + location (延迟 ${delay.toFixed(1)}s)`,
        });
      }
    }
  }

  return redirects;
}

/**
 * Collect body from a stream, up to MAX_BODY_SIZE
 */
function collectBody(stream) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let truncated = false;

    stream.on('data', (chunk) => {
      if (size + chunk.length > MAX_BODY_SIZE) {
        if (!truncated) {
          truncated = true;
          const remaining = MAX_BODY_SIZE - size;
          if (remaining > 0) chunks.push(chunk.slice(0, remaining));
        }
        stream.destroy();
      } else {
        chunks.push(chunk);
        size += chunk.length;
      }
    });

    stream.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      resolve({ body, truncated });
    });

    stream.on('error', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      resolve({ body, truncated });
    });

    // Safety timeout
    setTimeout(() => {
      const body = Buffer.concat(chunks).toString('utf-8');
      resolve({ body, truncated: true });
    }, 5000);
  });
}

function createProxyAgent(proxy) {
  const auth = proxy.username ? `${proxy.username}:${proxy.password || ''}@` : '';

  if (proxy.type === 'socks5') {
    return new SocksProxyAgent(`socks5://${auth}${proxy.host}:${proxy.port}`, { keepAlive: true, insecureHTTPParser: true });
  }

  const protocol = proxy.type === 'https' ? 'https' : 'http';
  return new HttpsProxyAgent(`${protocol}://${auth}${proxy.host}:${proxy.port}`, { keepAlive: true, insecureHTTPParser: true });
}

async function trackRedirects(originalUrl, proxy, userAgent, forceParams, forceHeaders, maxSteps = 20, onStep = null) {
  const startTime = Date.now();
  const steps = [];
  let currentUrl = originalUrl;
  let stoppedReason = '';
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

  // Parse force params: "k1=v1&k2=v2" -> Map
  const fpMap = new Map();
  if (forceParams && typeof forceParams === 'string') {
    for (const pair of forceParams.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        fpMap.set(pair.substring(0, eqIdx).trim(), pair.substring(eqIdx + 1).trim());
      }
    }
  }

  // Parse force headers: "Key: Value\nKey2: Value2" -> object
  const fhObj = {};
  if (forceHeaders && typeof forceHeaders === 'string') {
    for (const line of forceHeaders.split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        if (key) fhObj[key] = value;
      }
    }
  }

  // Apply force params to URL
  function applyForceParams(url) {
    if (fpMap.size === 0) return url;
    try {
      const u = new URL(url.startsWith('http') ? url : `http://${url}`);
      for (const [k, v] of fpMap) {
        if (u.searchParams.has(k)) {
          u.searchParams.set(k, v);
        } else {
          u.searchParams.append(k, v);
        }
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  for (let i = 0; i < maxSteps; i++) {
    const stepStart = Date.now();

    // Normalize URL - add http:// if no protocol
    if (!/^https?:\/\//i.test(currentUrl)) {
      currentUrl = 'http://' + currentUrl;
    }

    try {
      // Apply force params to current URL
      const effectiveUrl = applyForceParams(currentUrl);

      const axiosConfig = {
        method: 'GET',
        url: effectiveUrl,
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status >= 300,
        timeout: 30000,
        insecureHTTPParser: true,
        headers: {
          'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          ...fhObj,
        },
        responseType: 'stream',
      };

      if (proxy) {
        const agent = createProxyAgent(proxy);
        axiosConfig.httpsAgent = agent;
        axiosConfig.httpAgent = agent;
      }

      const response = await axios(axiosConfig);
      const responseTime = Date.now() - stepStart;

      // Collect headers
      const headers = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') {
          headers[key.toLowerCase()] = value;
        } else if (Array.isArray(value)) {
          headers[key.toLowerCase()] = value.join(', ');
        }
      }

      // Check if this is a file download
      const isFile = isFileDownloadUrl(currentUrl) || isFileDownloadHeader(headers);

      // Determine if this is a terminal response (not a 3xx redirect)
      const isTerminal = response.status < 300 || response.status >= 400;

      // For terminal responses or file downloads, capture body
      let body = null;
      let bodyTruncated = false;
      let htmlRedirects = [];

      if (isTerminal && isHtmlContent(headers) && !isFile) {
        const result = await collectBody(response.data);
        body = result.body;
        bodyTruncated = result.truncated;
        htmlRedirects = parseHtmlRedirects(body, currentUrl);
      } else if (isTerminal && !isFile) {
        const result = await collectBody(response.data);
        body = result.body;
        bodyTruncated = result.truncated;
      } else if (isFile) {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      } else {
        if (response.data && typeof response.data.destroy === 'function') {
          response.data.destroy();
        }
      }

      const step = {
        url: effectiveUrl,
        statusCode: response.status,
        statusText: response.statusText || '',
        responseTime,
        headers,
        isFileDownload: isFile,
        protocolChanged: false,
      };

      if (body !== null) {
        step.body = body;
        step.bodyTruncated = bodyTruncated;
        step.contentType = headers['content-type'] || '';
      }

      if (htmlRedirects.length > 0) {
        step.htmlRedirects = htmlRedirects;
      }

      steps.push(step);
      if (onStep) await onStep(step);

      if (isFile) {
        stoppedReason = '检测到文件下载';
        break;
      }

      if (isTerminal) {
        if (htmlRedirects.length > 0) {
          stoppedReason = '到达最终页面（检测到 HTML/JS 跳转）';
        }
        break;
      }

      const location = headers['location'];
      if (!location) {
        stoppedReason = '重定向响应缺少 Location 头';
        break;
      }

      let redirectUrl;
      try {
        redirectUrl = new URL(location, currentUrl).href;
      } catch {
        redirectUrl = location;
      }

      if (hasProtocolChanged(currentUrl, redirectUrl)) {
        steps[steps.length - 1].protocolChanged = true;
        const origProto = new URL(currentUrl).protocol;
        const redirProto = location.includes(':') ? location.split(':')[0] + ':' : 'unknown:';
        stoppedReason = `协议变更: ${origProto} -> ${redirProto}`;
        const protoStep = {
          url: location,
          statusCode: 0,
          statusText: 'Protocol Changed',
          responseTime: 0,
          headers: {},
          isFileDownload: false,
          protocolChanged: false,
        };
        steps.push(protoStep);
        if (onStep) await onStep(protoStep);
        break;
      }

      currentUrl = redirectUrl;

    } catch (error) {
      const responseTime = Date.now() - stepStart;

      if (error.response) {
        const headers = {};
        for (const [key, value] of Object.entries(error.response.headers || {})) {
          if (typeof value === 'string') {
            headers[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value.join(', ');
          }
        }

        let body = null;
        let bodyTruncated = false;
        try {
          if (error.response.data && typeof error.response.data.on === 'function') {
            const result = await collectBody(error.response.data);
            body = result.body;
            bodyTruncated = result.truncated;
          } else if (typeof error.response.data === 'string') {
            body = error.response.data.substring(0, MAX_BODY_SIZE);
          }
        } catch {}

        const step = {
          url: currentUrl,
          statusCode: error.response.status,
          statusText: error.response.statusText || '',
          responseTime,
          headers,
          isFileDownload: false,
          protocolChanged: false,
        };
        if (body) {
          step.body = body;
          step.bodyTruncated = bodyTruncated;
          step.contentType = headers['content-type'] || '';
        }
        steps.push(step);
        if (onStep) await onStep(step);
        stoppedReason = `HTTP 错误: ${error.response.status}`;
      } else {
        const netErrStep = {
          url: currentUrl,
          statusCode: 0,
          statusText: 'Network Error',
          responseTime,
          headers: {},
          isFileDownload: false,
          protocolChanged: false,
        };
        steps.push(netErrStep);
        if (onStep) await onStep(netErrStep);
        stoppedReason = error.code === 'ECONNABORTED' ? '请求超时' : `网络错误: ${error.message}`;
      }
      break;
    }
  }

  if (!stoppedReason && steps.length >= maxSteps) {
    stoppedReason = `达到最大追踪次数 (${maxSteps})`;
  }

  return {
    id,
    originalUrl,
    steps,
    finalUrl: steps.length > 0 ? steps[steps.length - 1].url : originalUrl,
    totalTime: Date.now() - startTime,
    stoppedReason,
    timestamp: new Date().toISOString(),
    proxyUsed: proxy ? `${proxy.type}://${proxy.host}:${proxy.port}` : null,
  };
}

module.exports = { trackRedirects };
