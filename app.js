
(() => {
"use strict";

const $ = id => document.getElementById(id);
const config = window.QURVIX_CONFIG || {};
const db = window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY
  ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
  : null;

let session = null;
let items = [];
let category = "All";
let currentItem = null;
let authMode = "login";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[c]);

const safeUrl = value => {
  try {
    const u = new URL(value);
    return ["https:","http:"].includes(u.protocol) ? u.href : "";
  } catch { return ""; }
};

function toast(text) {
  $("toast").textContent = text;
}

function youtubeId(value) {
  try {
    const u = new URL(value);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const p = u.pathname.split("/").filter(Boolean);
    const i = p.findIndex(x => ["embed","shorts","live"].includes(x));
    return i >= 0 ? p[i+1] : "";
  } catch { return ""; }
}

function getExtraLinks(item) {
  let links = item.extra_links || [];
  if (typeof links === "string") {
    try { links = JSON.parse(links); } catch { links = []; }
  }
  return Array.isArray(links) ? links.filter(x => safeUrl(x.url)) : [];
}

function card(item) {
  const image = safeUrl(item.image_url);
  const video = youtubeId(item.youtube_url || "");
  const media = `
    ${image ? `<img src="${esc(image)}" alt="${esc(item.title)}" style="width:100%;height:190px;object-fit:cover" onerror="this.style.display='none'">` : ""}
    ${video ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video)}" title="${esc(item.title)}" style="width:100%;aspect-ratio:16/9;border:0" allowfullscreen></iframe>` : ""}
  `;

  let links = "";
  if (safeUrl(item.url)) {
    links += `<a href="${esc(item.url)}" target="_blank" rel="noopener"> ${item.type === "download" ? "Download" : "Open Link"} ↗</a> `;
  }
  if (video) {
    links += `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(video)}" target="_blank" rel="noopener">Watch YouTube ↗</a> `;
  }
  getExtraLinks(item).forEach(x => {
    links += `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label || "Open Link")} ↗</a> `;
  });

  return `
  <article class="content-card" style="padding:15px;margin:12px 0;border-radius:14px;background:white">
    ${media}
    <small>${esc(item.category)}</small>
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.description)}</p>
    <div>${links}</div>
    <button data-comments="${esc(item.id)}">Comments</button>
  </article>`;
}

function render() {
  const term = $("searchInput").value.toLowerCase();
  const filtered = items.filter(x =>
    (category === "All" || x.category === category) &&
    (x.title + " " + x.description).toLowerCase().includes(term)
  );
  const articles = filtered.filter(x => x.type !== "download");
  const downloads = filtered.filter(x => x.type === "download");

  $("contentGrid").innerHTML = articles.map(card).join("") || "<p>No content found.</p>";
  $("downloadGrid").innerHTML = downloads.map(card).join("") || "<p>No downloads yet.</p>";

  document.querySelectorAll("[data-comments]").forEach(b => {
    b.onclick = () => openComments(b.dataset.comments);
  });
}

async function loadItems() {
  if (!db) return toast("Supabase configuration missing.");
  const {data,error} = await db.from("content")
    .select("id,title,category,type,description,image_url,url,youtube_url,extra_links,published,created_at")
    .eq("published",true).order("created_at",{ascending:false});
  if (error) return toast("Content error: " + error.message);
  items = data || [];
  render();
}

async function setUser(s) {
  session = s;
  const logged = !!s?.user;
  $("loginBtn").classList.toggle("hidden",logged);
  $("signupBtn").classList.toggle("hidden",logged);
  $("logoutBtn").classList.toggle("hidden",!logged);

  $("adminBtn")?.remove();
  if (!logged) return;

  const {data,error} = await db.from("profiles").select("role")
    .eq("id",s.user.id).maybeSingle();
  if (error) return toast("Admin check: " + error.message);

  if (data?.role === "admin") {
    const b = document.createElement("button");
    b.id = "adminBtn";
    b.textContent = "Admin";
    $("mainNav").appendChild(b);
    b.onclick = openAdmin;
  }
}

function openAuth(mode) {
  authMode = mode;
  $("authTitle").textContent = mode === "login" ? "Login" : "Sign up";
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create Account";
  $("nameField").classList.toggle("hidden",mode === "login");
  $("authStatus").textContent = "";
  $("authSwitch").innerHTML = mode === "login"
    ? 'New user? <button type="button" id="switchAuth">Sign up</button>'
    : 'Already registered? <button type="button" id="switchAuth">Login</button>';
  $("switchAuth").onclick = () => openAuth(mode === "login" ? "signup" : "login");
  $("authDialog").showModal();
}

$("loginBtn").onclick = () => openAuth("login");
$("signupBtn").onclick = () => openAuth("signup");

$("authForm").onsubmit = async e => {
  e.preventDefault();
  if (!db) return;
  $("authStatus").textContent = "Please wait...";
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  const result = authMode === "login"
    ? await db.auth.signInWithPassword({email,password})
    : await db.auth.signUp({
        email,password,
        options:{data:{display_name:$("displayName").value.trim()}}
      });

  if (result.error) {
    $("authStatus").textContent = result.error.message;
    return;
  }
  if (authMode === "signup" && !result.data.session) {
    $("authStatus").textContent = "Check your email to confirm your account.";
    return;
  }
  $("authDialog").close();
  await setUser(result.data.session);
  toast("Welcome to QURVIX!");
};

$("logoutBtn").onclick = async () => {
  const {error} = await db.auth.signOut();
  if (error) return toast(error.message);
  await setUser(null);
};

$("categories").onclick = e => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  category = b.dataset.cat;
  render();
};
$("searchInput").oninput = render;

async function openComments(id) {
  currentItem = items.find(x => String(x.id) === String(id));
  if (!currentItem) return;
  $("commentsTitle").textContent = currentItem.title;
  $("commentsList").textContent = "Loading...";
  $("commentsDialog").showModal();

  const {data,error} = await db.from("comments")
    .select("id,body,created_at")
    .eq("content_id",currentItem.id)
    .eq("approved",true)
    .order("created_at",{ascending:false});

  if (error) {
    $("commentsList").textContent = error.message;
    return;
  }
  $("commentsList").innerHTML = (data || []).map(c =>
    `<p style="padding:10px;border-bottom:1px solid #ddd">${esc(c.body)}</p>`
  ).join("") || "<p>No approved comments yet.</p>";
}

$("commentForm").onsubmit = async e => {
  e.preventDefault();
  if (!session?.user) {
    $("commentStatus").textContent = "Please login before commenting.";
    return;
  }
  const body = $("commentText").value.trim();
  if (!body || !currentItem) return;

  const {error} = await db.from("comments").insert({
    content_id:currentItem.id,
    user_id:session.user.id,
    body
  });
  if (error) {
    $("commentStatus").textContent = error.message;
    return;
  }
  $("commentText").value = "";
  $("commentStatus").textContent = "Comment submitted for approval.";
};

function parseLinks(text) {
  return text.split(/\r?\n/).map(line => {
    const i = line.indexOf("|");
    if (i < 0) return null;
    const label = line.slice(0,i).trim();
    const url = safeUrl(line.slice(i+1).trim());
    return url ? {label:label || "Open Link",url} : null;
  }).filter(Boolean);
}

async function openAdmin() {
  $("adminDialog").showModal();
  await loadAdminList();
}

async function loadAdminList() {
  const {data,error} = await db.from("content").select("*").order("created_at",{ascending:false});
  if (error) {
    $("adminList").textContent = error.message;
    return;
  }
  $("adminList").innerHTML = (data || []).map(x =>
    `<div style="padding:8px;border-bottom:1px solid #ddd">
      <b>${esc(x.title)}</b>
      <button data-edit="${esc(x.id)}">Edit</button>
      <button data-delete="${esc(x.id)}">Delete</button>
    </div>`
  ).join("");

  document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    const x = data.find(r => String(r.id) === b.dataset.edit);
    $("editId").value = x.id;
    $("itemTitle").value = x.title;
    $("itemCategory").value = x.category;
    $("itemType").value = x.type;
    $("itemDescription").value = x.description;
    $("itemImage").value = x.image_url || "";
    $("itemYoutube").value = x.youtube_url || "";
    $("itemUrl").value = x.url || "";
    let links = x.extra_links || [];
    if (typeof links === "string") {
      try { links = JSON.parse(links); } catch { links = []; }
    }
    $("itemExtraLinks").value = Array.isArray(links)
      ? links.map(l => `${l.label} | ${l.url}`).join("\n") : "";
  });

  document.querySelectorAll("[data-delete]").forEach(b => b.onclick = async () => {
    if (!confirm("Delete this post?")) return;
    const {error} = await db.from("content").delete().eq("id",b.dataset.delete);
    if (error) return toast(error.message);
    await loadAdminList();
    await loadItems();
  });
}

$("contentForm").onsubmit = async e => {
  e.preventDefault();
  if (!session?.user) return;
  const payload = {
    title:$("itemTitle").value.trim(),
    category:$("itemCategory").value,
    type:$("itemType").value,
    description:$("itemDescription").value.trim(),
    image_url:safeUrl($("itemImage").value) || null,
    youtube_url:safeUrl($("itemYoutube").value) || null,
    url:safeUrl($("itemUrl").value) || null,
    extra_links:parseLinks($("itemExtraLinks").value),
    published:true
  };

  const id = $("editId").value;
  const result = id
    ? await db.from("content").update(payload).eq("id",id)
    : await db.from("content").insert(payload);

  if (result.error) {
    $("adminStatus").textContent = result.error.message;
    return;
  }
  $("contentForm").reset();
  $("editId").value = "";
  $("adminStatus").textContent = "Content published successfully.";
  await loadAdminList();
  await loadItems();
};

async function start() {
  if (!db) return toast("Supabase configuration missing. Check config.js.");
  const {data,error} = await db.auth.getSession();
  if (error) toast(error.message);
  await setUser(data?.session || null);
  db.auth.onAuthStateChange((_event,s) => setUser(s));
  await loadItems();
}
start();
})();
