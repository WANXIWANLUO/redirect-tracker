use regex::Regex;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::LazyLock;
use std::time::Instant;
use tauri::{Emitter, Manager};
use url::Url;

// ─── Data Structures ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtmlRedirect {
    #[serde(rename = "type")]
    pub redirect_type: String,
    pub delay: f64,
    pub url: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedirectStep {
    pub url: String,
    #[serde(rename = "statusCode")]
    pub status_code: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    #[serde(rename = "responseTime")]
    pub response_time: u64,
    pub headers: HashMap<String, String>,
    #[serde(rename = "isFileDownload")]
    pub is_file_download: bool,
    #[serde(rename = "protocolChanged")]
    pub protocol_changed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "bodyTruncated")]
    pub body_truncated: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "contentType")]
    pub content_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "htmlRedirects")]
    pub html_redirects: Option<Vec<HtmlRedirect>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackResult {
    pub id: String,
    #[serde(rename = "originalUrl")]
    pub original_url: String,
    pub steps: Vec<RedirectStep>,
    #[serde(rename = "finalUrl")]
    pub final_url: String,
    #[serde(rename = "totalTime")]
    pub total_time: u64,
    #[serde(rename = "stoppedReason")]
    pub stopped_reason: String,
    pub timestamp: String,
    #[serde(rename = "proxyUsed")]
    pub proxy_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "proxyId")]
    pub proxy_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "uaId")]
    pub ua_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "countryUsed")]
    pub country_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "forceParamsUsed")]
    pub force_params_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "forceHeadersUsed")]
    pub force_headers_used: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "checkIpUsed")]
    pub check_ip_used: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "detectedIp")]
    pub detected_ip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub proxy_type: String,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackOptions {
    pub url: String,
    pub proxy: Option<ProxyConfig>,
    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,
    #[serde(rename = "forceParams")]
    pub force_params: Option<String>,
    #[serde(rename = "forceHeaders")]
    pub force_headers: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackResponse {
    pub success: bool,
    pub result: Option<TrackResult>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckIpResponse {
    pub success: bool,
    pub result: Option<CheckIpResult>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckIpResult {
    pub status: String,
    pub country: String,
    #[serde(rename = "countryCode")]
    pub country_code: String,
    pub query: String,
}

/// Event payload: emitted after each step completes
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TrackStepEvent {
    id: String,
    #[serde(rename = "stepIndex")]
    step_index: usize,
    step: RedirectStep,
}

/// Event payload: emitted when tracking finishes
#[derive(Debug, Clone, Serialize, Deserialize)]
struct TrackDoneEvent {
    id: String,
    result: TrackResult,
}

/// Response from a single tracking step (one HTTP request)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackStepResponse {
    pub step: RedirectStep,
    #[serde(rename = "nextUrl")]
    pub next_url: Option<String>,
    pub done: bool,
    #[serde(rename = "stoppedReason")]
    pub stopped_reason: Option<String>,
    #[serde(rename = "cookieHeaders")]
    pub cookie_headers: Option<String>,
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BODY_SIZE: usize = 200 * 1024; // 200KB
const MAX_STEPS: usize = 20;

static FILE_EXTENSIONS: LazyLock<Vec<&str>> = LazyLock::new(|| {
    vec![
        ".exe", ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".mp3", ".mp4", ".avi", ".mkv", ".mov", ".flv",
        ".iso", ".dmg", ".msi", ".deb", ".rpm",
        ".apk", ".ipa", ".war", ".jar",
    ]
});

// ─── Helper Functions ─────────────────────────────────────────────────────────

fn is_file_download_url(url_str: &str) -> bool {
    if let Ok(parsed) = Url::parse(url_str) {
        let path = parsed.path().to_lowercase();
        let path = path.split('?').next().unwrap_or(&path);
        return FILE_EXTENSIONS.iter().any(|ext| path.ends_with(ext));
    }
    false
}

fn is_file_download_header(headers: &HeaderMap) -> bool {
    if let Some(cd) = headers.get("content-disposition") {
        if let Ok(val) = cd.to_str() {
            return val.to_lowercase().contains("attachment");
        }
    }
    false
}

fn is_html_content(headers: &HeaderMap) -> bool {
    if let Some(ct) = headers.get("content-type") {
        if let Ok(val) = ct.to_str() {
            let val = val.to_lowercase();
            return val.contains("text/html") || val.contains("application/xhtml");
        }
    }
    false
}

fn has_protocol_changed(original: &str, redirect: &str) -> bool {
    if let (Ok(orig), Ok(redir)) = (Url::parse(original), Url::parse(redirect)) {
        let redir_scheme = redir.scheme();
        if redir_scheme == "http" || redir_scheme == "https" {
            return false;
        }
        return orig.scheme() != redir_scheme;
    }
    false
}

fn headers_to_map(headers: &HeaderMap) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for (key, value) in headers.iter() {
        if let Ok(v) = value.to_str() {
            map.insert(key.as_str().to_lowercase(), v.to_string());
        }
    }
    map
}

fn normalize_url(url_str: &str) -> String {
    if !url_str.starts_with("http://") && !url_str.starts_with("https://") {
        format!("http://{}", url_str)
    } else {
        url_str.to_string()
    }
}

fn resolve_redirect_url(current: &str, location: &str) -> String {
    match Url::parse(location) {
        Ok(_) => location.to_string(),
        Err(_) => {
            if let Ok(base) = Url::parse(current) {
                base.join(location)
                    .map(|u| u.to_string())
                    .unwrap_or_else(|_| location.to_string())
            } else {
                location.to_string()
            }
        }
    }
}

// ─── Proxy Agent Builder ──────────────────────────────────────────────────────

fn build_proxy(
    proxy: Option<&ProxyConfig>,
    builder: reqwest::ClientBuilder,
) -> reqwest::ClientBuilder {
    let Some(p) = proxy else {
        return builder;
    };

    let auth = match (&p.username, &p.password) {
        (Some(u), Some(pw)) if !u.is_empty() => format!("{}:{}@", u, pw),
        (Some(u), _) if !u.is_empty() => format!("{}@", u),
        _ => String::new(),
    };

    match p.proxy_type.as_str() {
        "socks5" => {
            let proxy_url = format!("socks5://{}{}:{}", auth, p.host, p.port);
            if let Ok(px) = reqwest::Proxy::all(&proxy_url) {
                return builder.proxy(px);
            }
        }
        "https" => {
            let proxy_url = format!("https://{}{}:{}", auth, p.host, p.port);
            if let Ok(px) = reqwest::Proxy::all(&proxy_url) {
                return builder.proxy(px);
            }
        }
        _ => {
            let proxy_url = format!("http://{}{}:{}", auth, p.host, p.port);
            if let Ok(px) = reqwest::Proxy::all(&proxy_url) {
                return builder.proxy(px);
            }
        }
    }

    builder
}

// ─── HTML Redirect Parsing ────────────────────────────────────────────────────

fn parse_html_redirects(html: &str, base_url: &str) -> Vec<HtmlRedirect> {
    let mut redirects: Vec<HtmlRedirect> = Vec::new();

    // 1. <meta http-equiv="refresh" content="0;url=...">
    let meta_pattern1 = Regex::new(
        r#"(?i)<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["']?\s*(\d+)\s*;\s*url\s*=\s*([^"'\s>]+)["']?[^>]*>"#
    ).unwrap();
    for cap in meta_pattern1.captures_iter(html) {
        let delay: f64 = cap[1].parse().unwrap_or(0.0);
        let target = cap[2].trim().trim_matches(|c| c == '\'' || c == '"').to_string();
        let resolved = resolve_relative_url(&target, base_url);
        redirects.push(HtmlRedirect {
            redirect_type: "meta-refresh".into(),
            delay,
            url: resolved.clone(),
            description: format!("<meta http-equiv=\"refresh\"> 延迟 {}s", delay),
        });
    }

    // 2. Reversed attribute order
    let meta_pattern2 = Regex::new(
        r#"(?i)<meta[^>]+content\s*=\s*["']?\s*(\d+)\s*;\s*url\s*=\s*([^"'\s>]+)["']?[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>"#
    ).unwrap();
    for cap in meta_pattern2.captures_iter(html) {
        let delay: f64 = cap[1].parse().unwrap_or(0.0);
        let target = cap[2].trim().trim_matches(|c| c == '\'' || c == '"').to_string();
        let resolved = resolve_relative_url(&target, base_url);
        // Avoid duplicates
        if !redirects.iter().any(|r| r.url == resolved) {
            redirects.push(HtmlRedirect {
                redirect_type: "meta-refresh".into(),
                delay,
                url: resolved.clone(),
                description: format!("<meta http-equiv=\"refresh\"> 延迟 {}s", delay),
            });
        }
    }

    // 3. JavaScript location redirects
    let js_patterns: Vec<(&str, &str)> = vec![
        (r#"(?i)window\.location\.href\s*=\s*["']([^"']+)["']"#, "window.location.href"),
        (r#"(?i)window\.location\s*=\s*["']([^"']+)["']"#, "window.location"),
        (r#"(?i)window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)"#, "window.location.replace"),
        (r#"(?i)window\.location\.assign\s*\(\s*["']([^"']+)["']\s*\)"#, "window.location.assign"),
        (r#"(?i)location\.href\s*=\s*["']([^"']+)["']"#, "location.href"),
        (r#"(?i)location\.replace\s*\(\s*["']([^"']+)["']\s*\)"#, "location.replace"),
        (r#"(?i)location\.assign\s*\(\s*["']([^"']+)["']\s*\)"#, "location.assign"),
        (r#"(?i)location\s*=\s*["']([^"']+)["']"#, "location ="),
    ];

    for (pattern_str, desc) in js_patterns {
        if let Ok(re) = Regex::new(pattern_str) {
            for cap in re.captures_iter(html) {
                let target = cap[1].trim().to_string();
                let resolved = resolve_relative_url(&target, base_url);
                if !redirects.iter().any(|r| r.url == resolved && r.redirect_type == "javascript") {
                    redirects.push(HtmlRedirect {
                        redirect_type: "javascript".into(),
                        delay: 0.0,
                        url: resolved.clone(),
                        description: format!("{} (JS 跳转)", desc),
                    });
                }
            }
        }
    }

    // 4. setTimeout + location patterns
    let timeout_re = Regex::new(
        r#"(?i)setTimeout\s*\(\s*function\s*\(\s*\)\s*\{[^}]*location[^}]*\}[^,]*,\s*(\d+)"#
    ).unwrap();
    for cap in timeout_re.captures_iter(html) {
        let delay = cap[1].parse::<f64>().unwrap_or(0.0) / 1000.0;
        let full_match = &cap[0];
        if let Some(loc_re) = Regex::new(r#"(?i)location(?:\.href)?\s*=\s*["']([^"']+)["']"#).ok() {
            if let Some(inner) = loc_re.captures(full_match) {
                let target = inner[1].trim().to_string();
                let resolved = resolve_relative_url(&target, base_url);
                if !redirects.iter().any(|r| r.url == resolved) {
                    redirects.push(HtmlRedirect {
                        redirect_type: "javascript".into(),
                        delay,
                        url: resolved.clone(),
                        description: format!("setTimeout + location (延迟 {:.1}s)", delay),
                    });
                }
            }
        }
    }

    redirects
}

fn resolve_relative_url(target: &str, base_url: &str) -> String {
    if Url::parse(target).is_ok() {
        return target.to_string();
    }
    if let Ok(base) = Url::parse(base_url) {
        if let Ok(resolved) = base.join(target) {
            return resolved.to_string();
        }
    }
    target.to_string()
}

// ─── Apply Force Params ───────────────────────────────────────────────────────

fn apply_force_params(url_str: &str, params: &HashMap<String, String>) -> String {
    if params.is_empty() {
        return url_str.to_string();
    }
    if let Ok(mut url) = Url::parse(&normalize_url(url_str)) {
        for (k, v) in params {
            if url.query_pairs().any(|(qk, _)| qk == k.as_str()) {
                let new_pairs: Vec<(String, String)> = url
                    .query_pairs()
                    .map(|(qk, qv)| {
                        if qk == k.as_str() {
                            (k.clone(), v.clone())
                        } else {
                            (qk.to_string(), qv.to_string())
                        }
                    })
                    .collect();
                url.query_pairs_mut().clear();
                for (qk, qv) in &new_pairs {
                    url.query_pairs_mut().append_pair(qk, qv);
                }
            } else {
                url.query_pairs_mut().append_pair(k, v);
            }
        }
        return url.to_string();
    }
    url_str.to_string()
}

fn parse_force_params(raw: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in raw.split('&') {
        if let Some(eq) = pair.find('=') {
            let key = pair[..eq].trim().to_string();
            let value = pair[eq + 1..].trim().to_string();
            if !key.is_empty() {
                map.insert(key, value);
            }
        }
    }
    map
}

fn parse_force_headers(raw: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    for line in raw.split('\n') {
        if let Some(colon) = line.find(':') {
            let key = line[..colon].trim();
            let value = line[colon + 1..].trim();
            if !key.is_empty() {
                if let (Ok(name), Ok(val)) = (
                    HeaderName::from_bytes(key.as_bytes()),
                    HeaderValue::from_str(value),
                ) {
                    headers.insert(name, val);
                }
            }
        }
    }
    headers
}

// ─── Collect Response Body ────────────────────────────────────────────────────

async fn collect_body(response: &mut reqwest::Response) -> (String, bool) {
    use tokio::time::{timeout, Duration};

    let result = timeout(Duration::from_secs(5), async {
        let mut body = Vec::new();
        let mut truncated = false;
        while let Ok(Some(chunk)) = response.chunk().await {
            if body.len() + chunk.len() > MAX_BODY_SIZE {
                if !truncated {
                    truncated = true;
                    let remaining = MAX_BODY_SIZE - body.len();
                    if remaining > 0 {
                        body.extend_from_slice(&chunk[..remaining]);
                    }
                }
                break;
            }
            body.extend_from_slice(&chunk);
        }
        (body, truncated)
    })
    .await;

    match result {
        Ok((body, truncated)) => {
            let text = String::from_utf8_lossy(&body).to_string();
            (text, truncated)
        }
        Err(_) => {
            // timeout — return empty
            (String::new(), true)
        }
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Single-step tracking: called by the frontend in a loop for real-time rendering.
/// Each call makes ONE HTTP request and returns the result immediately.
#[tauri::command(rename_all = "camelCase")]
async fn track_step(
    url: String,
    proxy: Option<ProxyConfig>,
    user_agent: Option<String>,
    force_params: Option<String>,
    force_headers: Option<String>,
    cookie_header: Option<String>,
) -> Result<TrackStepResponse, String> {
    let step_start = Instant::now();
    let current_url = normalize_url(&url);

    // Build client
    let mut client_builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true);

    client_builder = build_proxy(proxy.as_ref(), client_builder);

    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let default_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    let ua = user_agent.as_deref().unwrap_or(default_ua);

    // Parse force params & headers
    let fp_map = force_params.as_deref().map(parse_force_params).unwrap_or_default();
    let fh_map = force_headers.as_deref().map(parse_force_headers).unwrap_or_default();

    let effective_url = apply_force_params(&current_url, &fp_map);

    // Build headers
    let mut req_headers = HeaderMap::new();
    req_headers.insert(
        "User-Agent",
        HeaderValue::from_str(ua).unwrap_or_else(|_| HeaderValue::from_static("")),
    );
    req_headers.insert("Accept", HeaderValue::from_static(
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    ));
    req_headers.insert("Accept-Language", HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"));
    req_headers.insert("Connection", HeaderValue::from_static("keep-alive"));
    if let Some(ref cookie) = cookie_header {
        if !cookie.is_empty() {
            if let Ok(v) = HeaderValue::from_str(cookie) {
                req_headers.insert("Cookie", v);
            }
        }
    }
    for (key, value) in fh_map.iter() {
        req_headers.insert(key.clone(), value.clone());
    }

    let request = client.get(&effective_url).headers(req_headers);

    match request.send().await {
        Ok(mut response) => {
            let response_time = step_start.elapsed().as_millis() as u64;
            let status = response.status();
            let headers = headers_to_map(response.headers());
            let is_terminal = status.as_u16() < 300 || status.as_u16() >= 400;
            let is_file = is_file_download_url(&effective_url)
                || is_file_download_header(response.headers());

            // Collect Set-Cookie headers for next step
            let set_cookies: Vec<String> = response
                .headers()
                .get_all("set-cookie")
                .iter()
                .filter_map(|v| v.to_str().ok().map(|s| s.split(';').next().unwrap_or(s).to_string()))
                .collect();
            let cookie_headers = if set_cookies.is_empty() {
                None
            } else {
                Some(set_cookies.join("; "))
            };

            let mut body: Option<String> = None;
            let mut body_truncated = false;
            let mut html_redirects: Vec<HtmlRedirect> = Vec::new();

            if is_terminal && is_html_content(response.headers()) && !is_file {
                let (b, t) = collect_body(&mut response).await;
                html_redirects = parse_html_redirects(&b, &current_url);
                body = Some(b);
                body_truncated = t;
            } else if is_terminal && !is_file {
                let (b, t) = collect_body(&mut response).await;
                body = Some(b);
                body_truncated = t;
            }

            let mut step = RedirectStep {
                url: effective_url.clone(),
                status_code: status.as_u16(),
                status_text: status.canonical_reason().unwrap_or("").to_string(),
                response_time,
                headers,
                is_file_download: is_file,
                protocol_changed: false,
                body: None,
                body_truncated: None,
                content_type: None,
                html_redirects: None,
            };

            if let Some(ref b) = body {
                step.body = Some(b.clone());
                step.body_truncated = Some(body_truncated);
                step.content_type = step.headers.get("content-type").cloned();
            }
            if !html_redirects.is_empty() {
                step.html_redirects = Some(html_redirects);
            }

            // Determine if we should stop
            if is_file {
                return Ok(TrackStepResponse {
                    step,
                    next_url: None,
                    done: true,
                    stopped_reason: Some("检测到文件下载".into()),
                    cookie_headers,
                });
            }

            if is_terminal {
                let stopped = if step.html_redirects.as_ref().map_or(false, |r| !r.is_empty()) {
                    Some("到达最终页面（检测到 HTML/JS 跳转）".to_string())
                } else {
                    None
                };
                return Ok(TrackStepResponse {
                    step,
                    next_url: None,
                    done: true,
                    stopped_reason: stopped,
                    cookie_headers,
                });
            }

            // Follow redirect
            let location = response.headers().get("location").and_then(|v| v.to_str().ok());
            if let Some(loc) = location {
                let redirect_url = resolve_redirect_url(&current_url, loc);

                if has_protocol_changed(&current_url, &redirect_url) {
                    step.protocol_changed = true;
                    let orig_proto = Url::parse(&current_url)
                        .map(|u| u.scheme().to_string())
                        .unwrap_or_default();
                    let redir_proto = if loc.contains(':') {
                        loc.split(':').next().unwrap_or("unknown").to_string()
                    } else {
                        "unknown".to_string()
                    };

                    return Ok(TrackStepResponse {
                        step,
                        next_url: Some(loc.to_string()),
                        done: true,
                        stopped_reason: Some(format!("协议变更: {}: -> {}:", orig_proto, redir_proto)),
                        cookie_headers,
                    });
                }

                Ok(TrackStepResponse {
                    step,
                    next_url: Some(redirect_url),
                    done: false,
                    stopped_reason: None,
                    cookie_headers,
                })
            } else {
                Ok(TrackStepResponse {
                    step,
                    next_url: None,
                    done: true,
                    stopped_reason: Some("重定向响应缺少 Location 头".into()),
                    cookie_headers,
                })
            }
        }
        Err(err) => {
            let response_time = step_start.elapsed().as_millis() as u64;
            let err_status = err.status().map(|s| s.as_u16());

            if let Some(status_code) = err_status {
                let status_text = err
                    .status()
                    .and_then(|s| s.canonical_reason())
                    .unwrap_or("")
                    .to_string();
                let err_body = format!("HTTP 错误 {}: {}\n\n{}", status_code, status_text, err);
                Ok(TrackStepResponse {
                    step: RedirectStep {
                        url: effective_url.clone(),
                        status_code,
                        status_text,
                        response_time,
                        headers: HashMap::new(),
                        is_file_download: false,
                        protocol_changed: false,
                        body: Some(err_body),
                        body_truncated: Some(false),
                        content_type: Some("text/plain".into()),
                        html_redirects: None,
                    },
                    next_url: None,
                    done: true,
                    stopped_reason: Some(format!("HTTP 错误: {}", status_code)),
                    cookie_headers: None,
                })
            } else {
                let is_timeout = err.is_timeout();
                let err_body = if is_timeout {
                    format!("请求超时\n\n{}", err)
                } else {
                    format!("网络错误\n\n{}", err)
                };
                Ok(TrackStepResponse {
                    step: RedirectStep {
                        url: effective_url.clone(),
                        status_code: 0,
                        status_text: "Network Error".into(),
                        response_time,
                        headers: HashMap::new(),
                        is_file_download: false,
                        protocol_changed: false,
                        body: Some(err_body),
                        body_truncated: Some(false),
                        content_type: Some("text/plain".into()),
                        html_redirects: None,
                    },
                    next_url: None,
                    done: true,
                    stopped_reason: Some(if is_timeout {
                        "请求超时".into()
                    } else {
                        format!("网络错误: {}", err)
                    }),
                    cookie_headers: None,
                })
            }
        }
    }
}

#[tauri::command]
async fn track(app_handle: tauri::AppHandle, options: TrackOptions) -> Result<TrackResponse, String> {
    let start_time = Instant::now();
    let id = uuid::Uuid::new_v4().to_string();
    let mut steps: Vec<RedirectStep> = Vec::new();
    let mut current_url = options.url.clone();
    let mut stopped_reason = String::new();
    let max_steps = MAX_STEPS;

    if current_url.is_empty() {
        return Ok(TrackResponse {
            success: false,
            result: None,
            error: Some("请提供 URL".into()),
        });
    }

    // Parse force params
    let force_params_map = options
        .force_params
        .as_deref()
        .map(parse_force_params)
        .unwrap_or_default();

    // Parse force headers
    let force_headers = options
        .force_headers
        .as_deref()
        .map(parse_force_headers)
        .unwrap_or_default();

    // Build HTTP client
    let mut client_builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .cookie_store(true);

    client_builder = build_proxy(options.proxy.as_ref(), client_builder);

    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let default_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    let user_agent = options.user_agent.as_deref().unwrap_or(default_ua);

    for step_idx in 0..max_steps {
        let step_start = Instant::now();

        current_url = normalize_url(&current_url);

        // Apply force params
        let effective_url = apply_force_params(&current_url, &force_params_map);

        // Build headers
        let mut req_headers = HeaderMap::new();
        req_headers.insert(
            "User-Agent",
            HeaderValue::from_str(user_agent).unwrap_or_else(|_| HeaderValue::from_static("")),
        );
        req_headers.insert(
            "Accept",
            HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
        );
        req_headers.insert(
            "Accept-Language",
            HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8"),
        );
        req_headers.insert("Connection", HeaderValue::from_static("keep-alive"));

        // Merge force headers
        for (key, value) in force_headers.iter() {
            req_headers.insert(key.clone(), value.clone());
        }

        let request = client.get(&effective_url).headers(req_headers);

        match request.send().await {
            Ok(mut response) => {
                let response_time = step_start.elapsed().as_millis() as u64;
                let status = response.status();
                let headers = headers_to_map(response.headers());
                let is_terminal = status.as_u16() < 300 || status.as_u16() >= 400;
                let is_file = is_file_download_url(&effective_url)
                    || is_file_download_header(response.headers());

                // Collect body for terminal HTML responses
                let mut body: Option<String> = None;
                let mut body_truncated = false;
                let mut html_redirects: Vec<HtmlRedirect> = Vec::new();

                if is_terminal && is_html_content(response.headers()) && !is_file {
                    let (b, t) = collect_body(&mut response).await;
                    html_redirects = parse_html_redirects(&b, &current_url);
                    body = Some(b);
                    body_truncated = t;
                } else if is_terminal && !is_file {
                    let (b, t) = collect_body(&mut response).await;
                    body = Some(b);
                    body_truncated = t;
                }

                let mut step = RedirectStep {
                    url: effective_url.clone(),
                    status_code: status.as_u16(),
                    status_text: status
                        .canonical_reason()
                        .unwrap_or("")
                        .to_string(),
                    response_time,
                    headers,
                    is_file_download: is_file,
                    protocol_changed: false,
                    body: None,
                    body_truncated: None,
                    content_type: None,
                    html_redirects: None,
                };

                if let Some(ref b) = body {
                    step.body = Some(b.clone());
                    step.body_truncated = Some(body_truncated);
                    step.content_type = step.headers.get("content-type").cloned();
                }

                if !html_redirects.is_empty() {
                    step.html_redirects = Some(html_redirects);
                }

                steps.push(step.clone());

                // Emit real-time step event
                let _ = app_handle.emit("track-step", TrackStepEvent {
                    id: id.clone(),
                    step_index: step_idx,
                    step,
                });
                // Yield to flush the event to the frontend immediately
                tokio::task::yield_now().await;

                // Check stop conditions
                if is_file {
                    stopped_reason = "检测到文件下载".into();
                    break;
                }

                if is_terminal {
                    if steps.last().map_or(false, |s| {
                        s.html_redirects.as_ref().map_or(false, |r| !r.is_empty())
                    }) {
                        stopped_reason = "到达最终页面（检测到 HTML/JS 跳转）".into();
                    }
                    break;
                }

                // Follow redirect
                let location = response.headers().get("location").and_then(|v| v.to_str().ok());
                if let Some(loc) = location {
                    let redirect_url = resolve_redirect_url(&current_url, loc);

                    if has_protocol_changed(&current_url, &redirect_url) {
                        if let Some(last) = steps.last_mut() {
                            last.protocol_changed = true;
                        }
                        let orig_proto = Url::parse(&current_url)
                            .map(|u| u.scheme().to_string())
                            .unwrap_or_default();
                        let redir_proto = if loc.contains(':') {
                            loc.split(':').next().unwrap_or("unknown").to_string()
                        } else {
                            "unknown".to_string()
                        };
                        stopped_reason = format!("协议变更: {}: -> {}:", orig_proto, redir_proto);

                        let proto_step = RedirectStep {
                            url: loc.to_string(),
                            status_code: 0,
                            status_text: "Protocol Changed".into(),
                            response_time: 0,
                            headers: HashMap::new(),
                            is_file_download: false,
                            protocol_changed: false,
                            body: None,
                            body_truncated: None,
                            content_type: None,
                            html_redirects: None,
                        };
                        steps.push(proto_step.clone());
                        let _ = app_handle.emit("track-step", TrackStepEvent {
                            id: id.clone(),
                            step_index: step_idx + 1,
                            step: proto_step,
                        });
                        tokio::task::yield_now().await;
                        break;
                    }

                    current_url = redirect_url;
                } else {
                    stopped_reason = "重定向响应缺少 Location 头".into();
                    break;
                }
            }
            Err(err) => {
                let response_time = step_start.elapsed().as_millis() as u64;
                let err_status = err.status().map(|s| s.as_u16());

                if let Some(status_code) = err_status {
                    let status_text = err
                        .status()
                        .and_then(|s| s.canonical_reason())
                        .unwrap_or("")
                        .to_string();
                    let err_body = format!("HTTP 错误 {}: {}\n\n{}", status_code, status_text, err);

                    let err_step = RedirectStep {
                        url: effective_url.clone(),
                        status_code,
                        status_text,
                        response_time,
                        headers: HashMap::new(),
                        is_file_download: false,
                        protocol_changed: false,
                        body: Some(err_body),
                        body_truncated: Some(false),
                        content_type: Some("text/plain".into()),
                        html_redirects: None,
                    };
                    steps.push(err_step.clone());
                    let _ = app_handle.emit("track-step", TrackStepEvent {
                        id: id.clone(),
                        step_index: step_idx,
                        step: err_step,
                    });
                    tokio::task::yield_now().await;

                    stopped_reason = format!("HTTP 错误: {}", status_code);
                } else {
                    let is_timeout = err.is_timeout();
                    let err_body = if is_timeout {
                        format!("请求超时\n\n{}", err)
                    } else {
                        format!("网络错误\n\n{}", err)
                    };
                    let net_step = RedirectStep {
                        url: effective_url.clone(),
                        status_code: 0,
                        status_text: "Network Error".into(),
                        response_time,
                        headers: HashMap::new(),
                        is_file_download: false,
                        protocol_changed: false,
                        body: Some(err_body),
                        body_truncated: Some(false),
                        content_type: Some("text/plain".into()),
                        html_redirects: None,
                    };
                    steps.push(net_step.clone());
                    let _ = app_handle.emit("track-step", TrackStepEvent {
                        id: id.clone(),
                        step_index: step_idx,
                        step: net_step,
                    });
                    tokio::task::yield_now().await;

                    if is_timeout {
                        stopped_reason = "请求超时".into();
                    } else {
                        stopped_reason = format!("网络错误: {}", err);
                    }
                }
                break;
            }
        }
    }

    if stopped_reason.is_empty() && steps.len() >= max_steps {
        stopped_reason = format!("达到最大追踪次数 ({})", max_steps);
    }

    let final_url = steps
        .last()
        .map(|s| s.url.clone())
        .unwrap_or_else(|| options.url.clone());

    let proxy_used = options.proxy.as_ref().map(|p| {
        format!("{}://{}:{}", p.proxy_type, p.host, p.port)
    });

    let track_result = TrackResult {
        id: id.clone(),
        original_url: options.url.clone(),
        steps: steps.clone(),
        final_url: final_url.clone(),
        total_time: start_time.elapsed().as_millis() as u64,
        stopped_reason: stopped_reason.clone(),
        timestamp: chrono_now(),
        proxy_used: proxy_used.clone(),
        proxy_id: None,
        ua_id: None,
        country_used: None,
        alias: None,
        force_params_used: None,
        force_headers_used: None,
        check_ip_used: None,
        detected_ip: None,
    };

    // Emit final done event
    let _ = app_handle.emit("track-done", TrackDoneEvent {
        id: id.clone(),
        result: track_result.clone(),
    });
    tokio::task::yield_now().await;

    Ok(TrackResponse {
        success: true,
        result: Some(track_result),
        error: None,
    })
}

#[tauri::command]
async fn check_ip(proxy: Option<ProxyConfig>) -> Result<CheckIpResponse, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .danger_accept_invalid_certs(true);

    builder = build_proxy(proxy.as_ref(), builder);

    let client = builder
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    match client
        .get("http://ip-api.com/json/?fields=status,country,countryCode,query")
        .send()
        .await
    {
        Ok(resp) => match resp.bytes().await {
            Ok(bytes) => match serde_json::from_slice::<CheckIpResult>(&bytes) {
                Ok(data) => Ok(CheckIpResponse {
                    success: true,
                    result: Some(data),
                    error: None,
                }),
                Err(e) => Ok(CheckIpResponse {
                    success: false,
                    result: None,
                    error: Some(format!("解析 IP 数据失败: {}", e)),
                }),
            },
            Err(e) => Ok(CheckIpResponse {
                success: false,
                result: None,
                error: Some(format!("读取 IP 数据失败: {}", e)),
            }),
        },
        Err(e) => Ok(CheckIpResponse {
            success: false,
            result: None,
            error: Some(format!("IP 检查失败: {}", e)),
        }),
    }
}

fn chrono_now() -> String {
    use std::time::SystemTime;
    if let Ok(dur) = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
        let secs = dur.as_secs();
        // Simple ISO-8601-like format
        let days_since_epoch = secs / 86400;
        // Approximate date calculation (good enough for logging)
        let mut year = 1970i64;
        let mut remaining_days = days_since_epoch as i64;
        loop {
            let days_in_year = if is_leap(year) { 366 } else { 365 };
            if remaining_days < days_in_year {
                break;
            }
            remaining_days -= days_in_year;
            year += 1;
        }
        let month_days = if is_leap(year) {
            [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        } else {
            [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        };
        let mut month = 0;
        for (i, &md) in month_days.iter().enumerate() {
            if remaining_days < md {
                month = i;
                break;
            }
            remaining_days -= md;
            month = i;
        }
        let day = remaining_days + 1;
        let remaining_secs = secs % 86400;
        let hour = remaining_secs / 3600;
        let minute = (remaining_secs % 3600) / 60;
        let second = remaining_secs % 60;

        format!(
            "{}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            year,
            month + 1,
            day,
            hour,
            minute,
            second
        )
    } else {
        "unknown".into()
    }
}

fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

// ─── GitHub Update Check ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "latestVersion")]
    pub latest_version: String,
    #[serde(rename = "downloadUrl")]
    pub download_url: String,
    #[serde(rename = "releaseNotes")]
    pub release_notes: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
}

/// Compare semver versions: returns true if `new` > `old`
fn is_newer_version(new: &str, old: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };
    let new_parts = parse(new);
    let old_parts = parse(old);
    for i in 0..std::cmp::max(new_parts.len(), old_parts.len()) {
        let n = new_parts.get(i).unwrap_or(&0);
        let o = old_parts.get(i).unwrap_or(&0);
        if n > o {
            return true;
        }
        if n < o {
            return false;
        }
    }
    false
}

#[tauri::command]
async fn check_update() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.github.com/repos/WANXIWANLUO/redirect-tracker/releases/latest")
        .header("User-Agent", "ce-tiaozhuan-updater")
        .send()
        .await
        .map_err(|e| format!("检查更新失败: {}", e))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let tag_name = json["tag_name"]
        .as_str()
        .unwrap_or("")
        .trim_start_matches('v');
    let current = env!("CARGO_PKG_VERSION");

    log::info!(
        "[Updater] GitHub tag: {}, Local version: {}",
        tag_name,
        current
    );

    let available = is_newer_version(tag_name, current);

    let asset = json["assets"].as_array().and_then(|a| a.first());
    let download_url = asset
        .and_then(|a| a["browser_download_url"].as_str())
        .unwrap_or("")
        .to_string();
    let file_name = asset
        .and_then(|a| a["name"].as_str())
        .unwrap_or("update.exe")
        .to_string();

    let release_notes = json["body"].as_str().unwrap_or("").to_string();

    Ok(UpdateInfo {
        available,
        current_version: current.to_string(),
        latest_version: tag_name.to_string(),
        download_url,
        release_notes,
        file_name,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    #[serde(rename = "downloaded")]
    pub downloaded: u64,
    #[serde(rename = "total")]
    pub total: u64,
    #[serde(rename = "percent")]
    pub percent: f64,
}

#[tauri::command]
async fn download_update(app_handle: tauri::AppHandle, url: String, file_name: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("下载失败: {}", e))?;

    let total_size = resp.content_length().unwrap_or(0);

    let temp_dir = std::env::temp_dir().join("ce-tiaozhuan-update");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;

    let filepath = temp_dir.join(&file_name);
    let mut file =
        std::fs::File::create(&filepath).map_err(|e| format!("创建文件失败: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载失败: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("写入文件失败: {}", e))?;
        downloaded += chunk.len() as u64;

        let percent = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        let _ = app_handle.emit(
            "update-download-progress",
            DownloadProgress {
                downloaded,
                total: total_size,
                percent,
            },
        );
    }

    Ok(filepath.to_string_lossy().to_string())
}

#[tauri::command]
async fn install_update(app_handle: tauri::AppHandle, file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("安装包文件不存在".into());
    }

    std::process::Command::new(path)
        .spawn()
        .map_err(|e| format!("启动安装程序失败: {}", e))?;

    app_handle.exit(0);
    Ok(())
}

// ─── App Entry ────────────────────────────────────────────────────────────────

#[tauri::command]
async fn show_window(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Window stays hidden until React renders (see src/main.tsx)
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![track_step, track, check_ip, show_window, check_update, download_update, install_update])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
