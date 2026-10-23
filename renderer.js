const $ = (id) => document.getElementById(id);
let sites = [];
let activeIndex = -1;
let editingIndex = -1;
let ctxIndex = -1;

function normalizeUrl(raw) {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.href;
  } catch {
    return null;
  }
}

function faviconOf(url) {
  try { return new URL(url).origin + '/favicon.ico'; } catch { return ''; }
}

function render() {
  const list = $('siteList');
  list.innerHTML = '';
  if (!sites.length) {
    list.innerHTML = '<li class="empty">还没有网站，点 ＋ 添加</li>';
    return;
  }
  sites.forEach((site, i) => {
    const li = document.createElement('li');
    if (i === activeIndex) li.classList.add('active');
    li.title = site.url;
    const img = document.createElement('img');
    img.src = faviconOf(site.url);
    img.onerror = () => { img.style.visibility = 'hidden'; };
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = site.name;
    const share = document.createElement('button');
    share.className = 'share';
    share.textContent = '分享';
    share.title = '分享';
    share.onclick = (e) => { e.stopPropagation(); openShare(i); };
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '删除';
    del.title = '删除';
    del.onclick = (e) => { e.stopPropagation(); removeSite(i); };
    li.append(img, name, share, del);
    li.onclick = () => openSite(i);
    li.oncontextmenu = (e) => { e.preventDefault(); showCtx(i, e.clientX, e.clientY); };
    list.appendChild(li);
  });
}

async function persist() {
  await window.api.saveSites(sites);
  render();
}

function openSite(i) {
  activeIndex = i;
  $('welcome').classList.add('hidden');
  window.api.openSite(sites[i].url);
  render();
}

async function removeSite(i) {
  const ok = await window.api.confirm(`确定删除「${sites[i].name}」吗？`);
  if (!ok) return;
  sites.splice(i, 1);
  if (activeIndex === i) activeIndex = -1;
  else if (activeIndex > i) activeIndex--;
  await persist();
}

function openModal(i = -1) {
  editingIndex = i;
  $('modalTitle').textContent = i >= 0 ? '编辑网站' : '添加网站';
  $('nameInput').value = i >= 0 ? sites[i].name : '';
  $('urlInput').value = i >= 0 ? sites[i].url : '';
  $('formError').textContent = '';
  $('modal').classList.remove('hidden');
  window.api.setViewVisible(false);
  $('nameInput').focus();
}

function closeModal() {
  $('modal').classList.add('hidden');
  window.api.setViewVisible(true);
}

function showCtx(i, x, y) {
  ctxIndex = i;
  const m = $('ctxMenu');
  m.style.left = x + 'px';
  m.style.top = y + 'px';
  m.classList.remove('hidden');
}

// ---------- 分享 ----------
let shareIndex = -1;
let shareToken = 0;

function buildShareText(site, info) {
  const host = new URL(site.url).hostname;
  let intro = info.description;
  if (!intro && info.title && info.title !== site.name) intro = info.title;
  if (!intro) intro = `一个很实用的网站（${host}），推荐给你。`;
  return `【${site.name}】\n${intro}\n\n网址：${site.url}\n\n—— 来自「网站管理器」分享`;
}

// 文本框高度跟随内容，完整显示介绍
function fitShareText() {
  const t = $('shareText');
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 2 + 'px';
}

async function fillShare() {
  const site = sites[shareIndex];
  const token = ++shareToken;
  $('shareStatus').textContent = '正在读取网站介绍...';
  $('shareText').value = buildShareText(site, { title: '', description: '' });
  $('copyDone').textContent = '';
  const info = await window.api.siteInfo(site.url);
  if (token !== shareToken) return; // 弹窗已关闭或切换了网站
  $('shareText').value = buildShareText(site, info);
  fitShareText();
  $('shareStatus').textContent = info.description || info.title
    ? '已根据网站自身的介绍生成，可以直接修改下面的文字'
    : '没能读取到网站介绍，已使用默认文案，可以直接修改';
}

function openShare(i) {
  shareIndex = i;
  $('shareName').textContent = sites[i].name;
  $('shareModal').classList.remove('hidden');
  window.api.setViewVisible(false);
  fillShare();
}

function closeShare() {
  shareToken++;
  $('shareModal').classList.add('hidden');
  window.api.setViewVisible(true);
}

$('shareClose').onclick = closeShare;
$('shareRegen').onclick = fillShare;
$('shareText').oninput = fitShareText;
$('shareModal').onclick = (e) => { if (e.target.id === 'shareModal') closeShare(); };
$('shareCopy').onclick = async () => {
  await window.api.copyText($('shareText').value);
  $('copyDone').textContent = '✓ 已复制，可以粘贴到微信、QQ 等发送给好友';
};

$('addBtn').onclick = () => openModal();
$('cancelBtn').onclick = closeModal;
$('modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('modal').classList.contains('hidden')) closeModal();
  if (!$('shareModal').classList.contains('hidden')) closeShare();
});

$('siteForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  const url = normalizeUrl($('urlInput').value);
  if (!name) { $('formError').textContent = '请输入名称'; return; }
  if (!url) { $('formError').textContent = '网址格式不正确'; return; }
  if (editingIndex >= 0) sites[editingIndex] = { name, url };
  else sites.push({ name, url });
  closeModal();
  await persist();
};

document.addEventListener('click', () => $('ctxMenu').classList.add('hidden'));
$('ctxMenu').onclick = (e) => {
  const act = e.target.dataset.act;
  if (act === 'share') openShare(ctxIndex);
  if (act === 'edit') openModal(ctxIndex);
  if (act === 'delete') removeSite(ctxIndex);
};

document.querySelectorAll('#toolbar [data-nav]').forEach((b) => {
  b.onclick = () => window.api.nav(b.dataset.nav);
});

window.api.onNavState((s) => {
  $('address').textContent = s.url;
  $('backBtn').disabled = !s.canGoBack;
  $('fwdBtn').disabled = !s.canGoForward;
});
window.api.onLoading((l) => $('address').classList.toggle('loading', l));

// Translumo 屏幕翻译开关
const tSwitch = $('translumoSwitch');
tSwitch.onchange = async () => {
  tSwitch.disabled = true;
  tSwitch.checked = await window.api.translumoToggle(tSwitch.checked);
  tSwitch.disabled = false;
};
$('translumoPick').onclick = (e) => { e.preventDefault(); window.api.translumoPick(); };
window.api.onTranslumoState((running) => { if (!tSwitch.disabled) tSwitch.checked = running; });

(async () => {
  sites = await window.api.getSites();
  render();
  tSwitch.checked = await window.api.translumoStatus();
})();
