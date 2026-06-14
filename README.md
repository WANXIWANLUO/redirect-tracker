# 测跳转 (Redirect Tracker)

一个基于 Tauri 2 + React + Rust 构建的桌面端 URL 重定向链路追踪工具。输入一个 URL，自动追踪其完整的 HTTP 重定向链，实时展示每一步跳转的状态码、响应时间、响应头和 HTML/JS 跳转信息。

## 功能特性

- **实时链路追踪** — 逐步追踪 URL 重定向链，最多 20 跳，每一步即时渲染
- **多种重定向识别** — HTTP 3xx 重定向、`<meta http-equiv="refresh">`、JavaScript `location` 跳转
- **关键参数高亮** — 自动高亮 `offer_id`、`click_id`、`af_id`、`idfa`、`gaid` 等追踪核心参数，URL 和响应头中均生效
- **代理支持** — HTTP/HTTPS/SOCKS5 代理，用户名密码支持 `{country}`、`{random}`、`{stack}` 占位符，支持 JSON 导入导出
- **自定义 User-Agent** — 内置 iOS Safari / Android Chrome 多版本预设，支持自定义 UA，支持 JSON 导入导出
- **强传参数 & 请求头** — 可强制覆盖 URL 查询参数（如 `af_id=123&click_id=abc`），可自定义请求头
- **Cookie 自动传递** — 跨跳转自动携带 Set-Cookie，保证追踪链路连贯
- **IP 检测** — 追踪前通过 ip-api.com 检测当前代理出口 IP 和地区
- **响应体预览** — HTML 响应支持源码/预览双模式查看，自动截断超大内容（200KB）
- **文件下载检测** — 自动识别文件下载（扩展名 + Content-Disposition）并终止追踪
- **协议变更检测** — 检测 HTTP → 非 HTTP 协议跳转（如 `market://`、`intent://`）
- **历史记录** — 自动保存追踪历史，支持备注重命名、删除、一键恢复全部配置（代理/UA/地区/强传参数等）
- **5 种主题** — 浅色、暗色、深黑、午夜蓝、海洋蓝，基于 CSS 变量的主题系统
- **数据持久化** — 所有配置通过 localStorage 本地持久化
- **流畅启动** — 窗口默认隐藏，React 首帧渲染后才显示，避免白屏闪烁

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 |
| 后端 | Rust + Tauri 2 + reqwest + tokio |
| 构建 | Vite 6 + pnpm |

## 项目结构

```
redirect-tracker/
├── src/                        # 前端源码
│   ├── App.tsx                 # 主应用组件（状态管理 & 追踪逻辑）
│   ├── main.tsx                # 入口 + 延迟显示窗口
│   ├── types.ts                # TypeScript 类型定义
│   ├── utils.ts                # 工具函数（持久化、占位符替换）
│   ├── index.css               # 全局样式 & 5 种主题 CSS 变量
│   └── components/
│       ├── Sidebar.tsx          # 侧边栏（历史记录、备注编辑）
│       ├── TrackInput.tsx       # URL 输入 & 配置面板（代理/UA/地区/强传参数）
│       ├── RedirectChain.tsx    # 重定向链路展示（参数高亮、响应体预览）
│       ├── ProxyManager.tsx     # 代理管理弹窗（CRUD、导入导出、占位符说明）
│       └── UAManager.tsx        # UA 管理弹窗（预设、CRUD、导入导出）
├── src-tauri/                  # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs             # 应用入口
│       └── lib.rs              # Tauri 命令（track_step / track / check_ip / show_window）
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [Tauri 2 系统依赖](https://v2.tauri.app/start/prerequisites/)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建发布

```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`，Windows 下默认生成 NSIS 安装包。

## 核心工作原理

前端通过 `invoke` 调用 Tauri 后端的 `track_step` 命令，每次调用执行一次 HTTP 请求：

1. 使用 reqwest 发送请求（禁用自动重定向，30s 超时）
2. 收集 Set-Cookie 并传递给下一步
3. 检查响应状态码是否为 3xx，从 `Location` 头获取下一跳 URL
4. 如果是终端响应（2xx/4xx/5xx），解析 HTML 中的 meta-refresh 和 JavaScript 跳转
5. 检测文件下载（扩展名 + Content-Disposition）和协议变更（HTTP → 非 HTTP）
6. 将单步结果返回前端，前端立即渲染，然后继续下一步

此设计实现了**实时逐跳渲染**，用户可看到每一步跳转的过程。

## 代理占位符

代理的用户名和密码字段支持以下占位符：

| 占位符 | 说明 |
|--------|------|
| `{country}` | 替换为当前设置的国家/地区代码 |
| `{random}` | 每次追踪生成 8 位随机字符串（每次不同） |
| `{stack}` | 累积随机字符串，每次追加 4 位（同一次追踪内叠加） |

## 主题系统

基于 CSS 自定义属性（`@theme`）实现，5 种内置主题：

| 主题 | 风格 |
|------|------|
| 浅色 (light) | 白底浅色，清爽明亮 |
| 暗色 (dim) | 柔和暗色，舒适护眼 |
| 深黑 (dark) | 纯黑深色，默认主题 |
| 午夜蓝 (midnight) | 深蓝暗色，深邃静谧 |
| 海洋蓝 (ocean) | 海蓝暗色，清新海洋风 |

## 许可


