# 网站管理器

一个用 Electron 写的 Windows 桌面小工具：把常去的网站收进左侧列表，点一下就进，不用再开浏览器、翻书签、敲网址。内置网页视图、中文菜单栏、一键分享文案，还能顺手开关 Translumo 实时屏幕翻译。

整个应用只有 5 个源文件（`main.js`、`preload.js`、`index.html`、`renderer.js`、`style.css`），无框架、无打包器，改完直接跑。

---

## 功能

### 网站列表

- 左侧固定 240px 侧边栏，列出所有已收藏的网站，显示站点图标与名称
- 点 `＋` 添加：填名称与网址即可，网址不写 `https://` 会自动补全
- 右键任意网站弹出菜单：**分享 / 编辑 / 删除**
- 删除前弹出中文确认框，防止误删
- 点击列表项，右侧直接加载该网站
- 图标自动取站点根目录的 `/favicon.ico`，取不到就静默隐藏
- 首次启动内置两个示例站点（百度、哔哩哔哩）

### 内嵌浏览

右侧是一个独立的 `WebContentsView`，不是把网页塞进 iframe，所以绝大多数网站都能正常登录、正常渲染。

顶部工具栏（44px）提供：

| 按钮 | 作用 |
| --- | --- |
| 后退 / 前进 | 基于 Electron 的导航历史，无历史时自动禁用 |
| 刷新 | 重新加载当前页 |
| 首页 | 回到该网站最初打开的地址 |
| 地址栏 | 实时显示当前 URL，加载中会变灰提示 |
| 浏览器打开 | 用系统默认浏览器打开当前页面 |

`target="_blank"` 的链接不会弹新窗口，而是直接在当前视图内跳转，避免窗口满天飞。

### 一键分享

对任意网站点"分享"，程序会：

1. 用带浏览器 User-Agent 的请求抓取该页面
2. 自动识别页面编码（先看响应头 `charset`，再看 `<meta charset>`，都没有按 UTF-8）
3. 提取 `og:title` 或 `<title>`，提取 `description` 或 `og:description`
4. 拼成一段可直接发微信 / QQ 的文案：

```
【网站名称】
网站简介……

网址：https://……

—— 来自「网站管理器」分享
```

- 抓不到简介时自动降级为"一个很实用的网站（域名），推荐给你。"
- 遇到验证码页、人机验证页、403 页面会识别出来并放弃抓取，不会把"安全验证"当成网站简介
- 文本框高度随内容自适应，可手动修改后再点"一键复制"
- 复制成功会提示"✓ 已复制，可以粘贴到微信、QQ 等发送给好友"

### Translumo 屏幕翻译开关

侧边栏"工具"区提供一个开关，用来启动 / 关闭 [Translumo](https://github.com/ramjke/Translumo) 实时屏幕翻译：

- 首次使用会让你选择 `Translumo.exe` 的位置，选择结果会记住
- 没下载过的话，弹窗里有"去下载"按钮直达 Releases 页
- 打开开关：以独立进程启动 Translumo，随后每 3 秒同步一次运行状态（即使你在 Translumo 自己的窗口里把它关了，这边开关也会跟着变）
- 关闭开关：直接 `taskkill` 结束 Translumo 进程
- 启动失败会弹错误框，不会静默失败

### 其他细节

- 菜单栏完全中文化：文件 / 编辑 / 浏览 / 窗口，快捷键保留 `Ctrl+Q`、`Alt+←/→`、`F5`、`Alt+Home`
- 弹窗打开时自动隐藏网页视图，避免网页盖在对话框上方
- 按 `Esc` 可关闭添加 / 编辑 / 分享弹窗，点遮罩也能关
- 页面设置了 CSP（`default-src 'self'`），只允许加载本地资源与外部图片

---

## 运行

### 环境

- Windows 10 / 11
- Node.js 16 以上（推荐 LTS）

### 方式一：双击脚本（推荐）

双击 `网站管理器.bat`。脚本会：

1. 检查 Node.js 是否安装
2. 首次运行自动 `npm install`（走 npmmirror 镜像，约 1-3 分钟）
3. 之后每次直接启动 Electron

> 脚本使用 `%~dp0` 定位自身目录，放在任何路径下都能用。

### 方式二：命令行

```bash
npm install
npm start
```

### 直接下载安装包

不想装 Node.js 的话，直接去 [Releases](https://github.com/moruoxi0818/website-manager/releases/latest) 下载 `WebsiteManager-1.0.0-Setup.exe`，双击即可安装。

> 安装包未做代码签名，首次运行若出现「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」。

### 打包成安装程序

```bash
npm run dist
```

产物在 `dist/` 下，生成 NSIS 安装包，特性：

- 非一键安装，允许用户自选安装目录
- 自动创建桌面快捷方式与开始菜单项
- 安装界面为简体中文
- 关闭了 exe 签名与元数据编辑（`signAndEditExe: false`），避免无证书环境打包失败

---

## 目录结构

```
网站管理器/
├─ main.js          ← 主进程：窗口、网页视图、菜单、IPC、数据读写、分享抓取、Translumo 控制
├─ preload.js       ← 预加载：通过 contextBridge 暴露 window.api
├─ index.html       ← 界面骨架（侧边栏 / 工具栏 / 添加弹窗 / 分享弹窗 / 右键菜单）
├─ renderer.js      ← 渲染进程逻辑：列表渲染、增删改、分享、导航状态
├─ style.css        ← 全部样式
├─ package.json     ← 依赖与 electron-builder 打包配置
├─ 网站管理器.bat   ← 一键启动脚本
└─ .npmrc           ← npm 镜像源（npmmirror）
```

---

## 数据存在哪

这是本项目的重点设计：**你的网站列表不会进入代码仓库，也不在项目文件夹里。**

| 数据 | 位置 |
| --- | --- |
| 网站列表 `sites.json` | `%APPDATA%\网站管理器\sites.json` |
| 程序设置 `settings.json`（如 Translumo 路径） | `%APPDATA%\网站管理器\settings.json` |

也就是说，程序代码和用户数据完全分离：仓库里只有代码，你的网址、你的使用记录都留在本机用户目录下，卸载或换电脑时不会跟着仓库走。`.gitignore` 中也额外加入了 `sites.json`、`settings.json`，即使有人把文件误放进项目目录也不会被提交。

> 仓库中不含作者本人的任何网站列表。首次运行你会看到的是 `main.js` 里写死的两个示例站点。

---

## 技术栈

| 项 | 说明 |
| --- | --- |
| 运行时 | Electron 33 |
| 页面渲染 | 原生 HTML / CSS / JavaScript，无框架 |
| 内嵌浏览 | `WebContentsView`（Electron 新 API） |
| 进程通信 | `ipcMain.handle` + `contextBridge`，渲染进程不直接接触 Node |
| 网络抓取 | Electron `net.fetch`，8 秒超时，`AbortController` 中止 |
| 编码识别 | 响应头 → `<meta charset>` → UTF-8 三级回退，`TextDecoder` 解码 |
| 打包 | electron-builder + NSIS |

---

## 已知限制

- 仅支持 Windows（`tasklist` / `taskkill` 为 Windows 命令）
- 网站数据不入云、不同步，换机器需要手动迁移 `sites.json`
- 一些做了严格防盗链或需要登录的站点可能取不到标题与简介，此时分享文案走默认模板
- 不支持拖拽排序、分组、搜索（列表规模小时够用）
- Translumo 是外部程序，本项目只负责启停与记录路径，不包含其本体
- 打包产物关闭了签名，部分杀毒软件可能对未签名 exe 报警

---

## 说明

- 本项目为个人自用小工具，代码结构简单，方便二次修改
- 未包含任何用户数据、账号信息或密钥
