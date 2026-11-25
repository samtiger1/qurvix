(() => {
  const $ = (id) => document.getElementById(id);
  const cfg = window.QURVIX_CONFIG || {};
  const configured = cfg.SUPABASE_URL?.startsWith("https://") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("PASTE_");
  const db = configured && window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  let session = null, currentItems = [], selectedCategory = "All", currentCommentItem = null, authMode = "login";
  $("year").textContent = new Date().getFullYear();

  const esc = (s="") => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const toast = (msg) => { $("toast").textContent = msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"), 2800); };
  const placeholder = [{id:"demo1",title:"Welcome to QURVIX",category:"Knowledge",description:"Your all-in-one destination is ready. Admins can publish the first stories from the dashboard.",type:"article",created_at:new Date().toISOString()},{id:"demo2",title:"Explore the latest in technology",category:"Technology",description:"Add your technology updates, explainers and useful discoveries here.",type:"article",created_at:new Date().toISOString()},{id:"demo3",title:"QURVIX Download Center",category:"Gaming",description:"Admin can add official game and app download links. Always link to trusted publishers.",type:"download",created_at:new Date().toISOString(),url:"#"}];

  function itemCard(item) {
    const isDownload = item.type === "download";
    return `<article class="content-card">${item.image_url ? `<img class="card-image" src="${esc(item.image_url)}" alt="" loading="lazy" onerror="this.remove()">` : `<div class="card-art">${esc(item.category?.slice(0,1) || "Q")}</div>`}<div class="card-body"><span class="tag">${esc(item.category || "General")}</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><div class="card-bottom">${isDownload && item.url ? `<a class="small-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open download ↗</a>` : `<span class="muted">${new Date(item.created_at || Date.now()).toLocaleDateString()}</span>`}<button class="comment-link" data-comments="${esc(item.id)}">Comments</button></div></div></article>`;
  }
  function render() {
    const q = $("searchInput").value.trim().toLowerCase();
    const filtered = currentItems.filter(x => (selectedCategory==="All" || x.category===selectedCategory) && (`${x.title} ${x.description} ${x.category}`.toLowerCase().includes(q)));
    const articles = filtered.filter(x=>x.type!=="download"), downloads = filtered.filter(x=>x.type==="download");
    $("contentGrid").innerHTML = articles.length ? articles.map(itemCard).join("") : `<div class="empty">No articles found yet. Check back soon.</div>`;
    $("downloadGrid").innerHTML = downloads.length ? downloads.map(itemCard).join("") : `<div class="empty">No downloads published yet.</div>`;
    document.querySelectorAll("[data-comments]").forEach(b=>b.addEventListener("click",()=>openComments(b.dataset.comments)));
    if(session?.user) $("contentGrid").querySelectorAll(".comment-link").forEach(b=>b.title="Join the discussion");
  }
  async function loadItems() {
    if(!db) { currentItems=placeholder; render(); toast("Connect Supabase to enable live content and accounts."); return; }
    const {data,error}=await db.from("content").select("*").eq("published",true).order("created_at",{ascending:false});
    if(error){currentItems=placeholder;toast("Could not load content. Check Supabase setup.");} else currentItems=data||[];
    render();
  }
  function setUser(s) {
    session=s;
    const logged=!!s?.user;
    $("loginBtn").classList.toggle("hidden",logged); $("signupBtn").classList.toggle("hidden",logged); $("logoutBtn").classList.toggle("hidden",!logged);
    if(logged) checkAdmin();
  }
  async function checkAdmin() {
    if(!db || !session?.user) return;
    const {data}=await db.from("profiles").select("role,display_name").eq("id",session.user.id).maybeSingle();
    if(data?.role==="admin") { $("mainNav").insertAdjacentHTML("beforeend",'<button class="nav-admin" id="adminBtn">Admin</button>'); $("adminBtn").onclick=openAdmin; }
  }
  function openAuth(mode) {
    authMode=mode; $("authTitle").textContent=mode==="login"?"Login":"Create account"; $("authSubmit").textContent=mode==="login"?"Login":"Sign up";
    $("nameField").classList.toggle("hidden",mode==="login"); $("authPassword").autocomplete=mode==="login"?"current-password":"new-password";
    $("authSwitch").innerHTML=mode==="login"?'New here? <button type="button" class="text-btn" id="switchAuth">Create an account</button>':'Already registered? <button type="button" class="text-btn" id="switchAuth">Login</button>';
    $("switchAuth").onclick=()=>openAuth(mode==="login"?"signup":"login"); $("authStatus").textContent=""; $("authDialog").showModal();
  }
  $("loginBtn").onclick=()=>openAuth("login"); $("signupBtn").onclick=()=>openAuth("signup");
  $("authForm").onsubmit=async e=>{
    e.preventDefault(); if(!db){$("authStatus").textContent="Supabase setup is required first. See README.";return;}
    const email=$("authEmail").value.trim(), password=$("authPassword").value;
    $("authSubmit").disabled=true; $("authStatus").textContent="Please wait…";
    let result;
    if(authMode==="login") result=await db.auth.signInWithPassword({email,password});
    else result=await db.auth.signUp({email,password,options:{data:{display_name:$("displayName").value.trim()}}});
    $("authSubmit").disabled=false;
    if(result.error){$("authStatus").textContent=result.error.message;return;}
    if(authMode==="signup" && !result.data.session){$("authStatus").textContent="Account created. Check your email to confirm, then log in.";}
    else {$("authDialog").close();toast("Welcome to QURVIX!");}
  };
  $("logoutBtn").onclick=async()=>{await db?.auth.signOut();setUser(null);document.getElementById("adminBtn")?.remove();toast("Logged out.");};
  $("categories").onclick=e=>{const b=e.target.closest("[data-cat]");if(!b)return;selectedCategory=b.dataset.cat;document.querySelectorAll(".chip").forEach(x=>x.classList.toggle("active",x===b));render();};
  $("searchInput").oninput=render;

  async function openComments(id) {
    currentCommentItem=currentItems.find(x=>String(x.id)===String(id)); if(!currentCommentItem)return;
    $("commentsTitle").textContent=currentCommentItem.title; $("commentsList").innerHTML="<p class='muted'>Loading comments…</p>"; $("commentStatus").textContent="";
    $("commentsDialog").showModal();
    if(!db){$("commentsList").innerHTML="<p class='muted'>Comments will be available after Supabase is connected.</p>";return;}
    const {data,error}=await db.from("comments").select("id,body,created_at,user_id,profiles(display_name)").eq("content_id",id).eq("approved",true).order("created_at",{ascending:false});
    $("commentsList").innerHTML=error?"<p class='muted'>Unable to load comments.</p>":(data||[]).map(c=>`<div class="comment"><b>${esc(c.profiles?.display_name||"QURVIX member")}</b><p>${esc(c.body)}</p><small>${new Date(c.created_at).toLocaleString()}</small></div>`).join("")||"<p class='muted'>Be the first to comment.</p>";
  }
  $("commentForm").onsubmit=async e=>{
    e.preventDefault(); if(!session?.user){$("commentStatus").textContent="Please log in before commenting.";return;}
    const body=$("commentText").value.trim(); if(!body)return;
    const {error}=await db.from("comments").insert({content_id:currentCommentItem.id,user_id:session.user.id,body});
    $("commentStatus").textContent=error?error.message:"Comment submitted for moderation.";
    if(!error){$("commentText").value="";toast("Comment submitted.");}
  };
  async function openAdmin() {
    $("adminDialog").showModal(); await loadAdminList();
  }
  async function loadAdminList() {
    const {data,error}=await db.from("content").select("*").order("created_at",{ascending:false});
    $("adminList").innerHTML=error?"Could not load admin content.":(data||[]).map(x=>`<div class="admin-row"><div><b>${esc(x.title)}</b><small>${esc(x.category)} · ${x.published?"Published":"Draft"}</small></div><div><button class="tiny-btn" data-edit="${x.id}">Edit</button><button class="tiny-btn danger" data-delete="${x.id}">Delete</button></div></div>`).join("")||"<p class='muted'>No content yet.</p>";
    $("adminList").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{const x=data.find(y=>String(y.id)===b.dataset.edit);$("editId").value=x.id;$("itemTitle").value=x.title;$("itemCategory").value=x.category;$("itemType").value=x.type;$("itemDescription").value=x.description;$("itemImage").value=x.image_url||"";$("itemUrl").value=x.url||"";});
    $("adminList").querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this content?"))return;const {error}=await db.from("content").delete().eq("id",b.dataset.delete);if(error)toast(error.message);else{toast("Deleted.");await loadAdminList();await loadItems();}});
  }
  $("contentForm").onsubmit=async e=>{
    e.preventDefault();const id=$("editId").value;
    const payload={title:$("itemTitle").value.trim(),category:$("itemCategory").value,type:$("itemType").value,description:$("itemDescription").value.trim(),image_url:$("itemImage").value.trim()||null,url:$("itemUrl").value.trim()||null,published:true,updated_at:new Date().toISOString()};
    const result=id?await db.from("content").update(payload).eq("id",id):await db.from("content").insert(payload);
    $("adminStatus").textContent=result.error?result.error.message:"Saved successfully.";
    if(!result.error){$("contentForm").reset();$("editId").value="";await loadAdminList();await loadItems();}
  };
  $("menuBtn").onclick=()=>$("mainNav").classList.toggle("open");
  if(db){db.auth.getSession().then(({data})=>setUser(data.session));db.auth.onAuthStateChange((_event,s)=>setUser(s));}
  loadItems();
})();