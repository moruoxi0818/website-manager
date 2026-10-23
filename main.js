const { app, BrowserWindow, WebContentsView, ipcMain, shell, Menu, dialog, net, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const SIDEBAR_WIDTH = 240;
const TOOLBAR_HEIGHT = 44;

let win;
let view;
let homeUrl = null;

const dataFile = () => path.join(app.getPath('userData'), 'sites.json');

const DEFAULT_SITES = [
  { name: '百度', url: 'https://www.baidu.com' },
  { name: '哔哩哔哩', url: 'https://www.bilibili.com' },
];

// 中文菜单栏，替换 Electron 默认的英文菜单
function buildMenu() {
  const nav = (action) => () => handleNav(action);
  return Menu.buildFromTemplate([
    {
      label: '文件',
      submenu: [{ label: '退出', accelerator: 'Ctrl+Q', click: () => app.quit() }],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '浏览',
      submenu: [
        { label: '后退', accelerator: 'Alt+Left', click: nav('back') },
        { label: '前进', accelerator: 'Alt+Right', click: nav('forward') },
        { label: '刷新', accelerator: 'F5', click: nav('reload') },
        { label: '回到首页', accelerator: 'Alt+Home', click: nav('home') },
        { label: '在浏览器中打开', click: nav('external') },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize' },
        { label: '全屏', role: 'togglefullscreen' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '实际大小', role: 'resetZoom' },
      ],
    },
  ]);
}

function loadSites() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return DEFAULT_SITES;
  }
}

function saveSites(sites) {
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(dataFile(), JSON.stringify(sites, null, 2), 'utf8');
}

function layoutView() {
  if (!view) return;
  const [w, h] = win.getContentSize();
  view.setBounds({
    x: SIDEBAR_WIDTH,
    y: TOOLBAR_HEIGHT,
    width: Math.max(0, w - SIDEBAR_WIDTH),
    height: Math.max(0, h - TOOLBAR_HEIGHT),
  });
}

function sendNavState() {
  const wc = view.webContents;
  win.webContents.send('nav-state', {
    url: wc.getURL(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
  });
}

function ensureView() {
  if (view) return view;
  view = new WebContentsView();
  win.contentView.addChildView(view);
  layoutView();
  const wc = view.webContents;
  // target=_blank 链接在当前视图内打开
  wc.setWindowOpenHandler(({ url }) => {
    wc.loadURL(url);
    return { action: 'deny' };
  });
  ['did-navigate', 'did-navigate-in-page', 'did-stop-loading'].forEach((e) => wc.on(e, sendNavState));
  wc.on('did-start-loading', () => win.webContents.send('loading', true));
  wc.on('did-stop-loading', () => win.webContents.send('loading', false));
  return view;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: '网站管理器',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
  win.on('resize', layoutView);
}

ipcMain.handle('get-sites', () => loadSites());
ipcMain.handle('save-sites', (_e, sites) => saveSites(sites));
ipcMain.handle('open-site', (_e, url) => {
  homeUrl = url;
  ensureView().webContents.loadURL(url);
});
ipcMain.handle('nav', (_e, action) => handleNav(action));

function handleNav(action) {
  if (!view) return;
  const wc = view.webContents;
  if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  if (action === 'reload') wc.reload();
  if (action === 'home' && homeUrl) wc.loadURL(homeUrl);
  if (action === 'external') shell.openExternal(wc.getURL());
}

// 中文按钮的确认框
ipcMain.handle('confirm', async (_e, message) => {
  const { response } = await dialog.showMessageBox(win, {
    type: 'question',
    title: '确认',
    message,
    buttons: ['确定', '取消'],
    defaultId: 1,
    cancelId: 1,
  });
  return response === 0;
});

// ---------- 分享：读取网站标题和简介 ----------
function decodeHtml(buf, contentType) {
  const bytes = Buffer.from(buf);
  let charset = (/charset=([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!charset) {
    const head = bytes.subarray(0, 4096).toString('latin1');
    charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1];
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

function unescapeHtml(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function metaContent(html, key) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i');
  const tag = (re.exec(html) || [])[0];
  if (!tag) return '';
  return unescapeHtml((/content=["']([^"']*)["']/i.exec(tag) || [])[1] || '');
}

// 像普通浏览器一样请求，否则不少网站会返回空页面或验证码页
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};
const BLOCKED_PAGE = /验证码|安全验证|人机验证|captcha|access denied|just a moment|403 forbidden/i;

ipcMain.handle('site-info', async (_e, url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await net.fetch(url, { signal: controller.signal, headers: BROWSER_HEADERS });
    const html = decodeHtml(await res.arrayBuffer(), res.headers.get('content-type'));
    const title = metaContent(html, 'og:title') || unescapeHtml((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '');
    if (!res.ok || BLOCKED_PAGE.test(title)) return { title: '', description: '' };
    return {
      title,
      description: metaContent(html, 'description') || metaContent(html, 'og:description'),
    };
  } catch {
    return { title: '', description: '' };
  } finally {
    clearTimeout(timer);
  }
});

ipcMain.handle('copy-text', (_e, text) => clipboard.writeText(text));

// 弹出对话框时临时隐藏网页视图，避免被遮挡
ipcMain.handle('set-view-visible', (_e, visible) => {
  if (view) view.setVisible(visible);
});

// ---------- Translumo 屏幕翻译 ----------
const TRANSLUMO_EXE = 'Translumo.exe';
const TRANSLUMO_DOWNLOAD = 'https://github.com/ramjke/Translumo/releases';
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}

function saveSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2), 'utf8');
}

// 是否有 Translumo 进程在运行（包括不是从本软件启动的）
function isTranslumoRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', `IMAGENAME eq ${TRANSLUMO_EXE}`, '/NH'], (err, out) => {
      resolve(!err && out.toLowerCase().includes(TRANSLUMO_EXE.toLowerCase()));
    });
  });
}

function stopTranslumo() {
  return new Promise((resolve) => {
    execFile('taskkill', ['/IM', TRANSLUMO_EXE, '/T', '/F'], () => resolve());
  });
}

async function pickTranslumoPath() {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '请选择 Translumo.exe',
    filters: [{ name: 'Translumo', extensions: ['exe'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return null;
  const s = loadSettings();
  s.translumoPath = filePaths[0];
  saveSettings(s);
  return filePaths[0];
}

async function ensureTranslumoPath() {
  const p = loadSettings().translumoPath;
  if (p && fs.existsSync(p)) return p;
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: '屏幕翻译',
    message: '还没有设置 Translumo 的位置',
    detail: '如果已经下载并解压了 Translumo，请点「选择 Translumo.exe」。\n如果还没下载，请点「去下载」，下载 zip 解压后再回来设置。',
    buttons: ['选择 Translumo.exe', '去下载', '取消'],
    cancelId: 2,
  });
  if (response === 1) shell.openExternal(TRANSLUMO_DOWNLOAD);
  if (response !== 0) return null;
  return pickTranslumoPath();
}

async function sendTranslumoState() {
  if (win && !win.isDestroyed()) win.webContents.send('translumo-state', await isTranslumoRunning());
}

ipcMain.handle('translumo-status', () => isTranslumoRunning());
ipcMain.handle('translumo-toggle', async (_e, on) => {
  if (!on) {
    await stopTranslumo();
  } else if (!(await isTranslumoRunning())) {
    const exe = await ensureTranslumoPath();
    if (exe) {
      const child = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' });
      child.on('error', (err) => dialog.showErrorBox('启动 Translumo 失败', err.message));
      child.on('exit', sendTranslumoState);
      child.unref();
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return isTranslumoRunning();
});
ipcMain.handle('translumo-pick', () => pickTranslumoPath());

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu());
  createWindow();
  // 定时同步开关状态（用户可能在 Translumo 自己的窗口里把它关掉）
  setInterval(sendTranslumoState, 3000);
});
app.on('window-all-closed', () => app.quit());
