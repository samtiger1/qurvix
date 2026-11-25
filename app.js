(() => {
'use strict';
const $ = id => document.getElementById(id);
const cfg = window.QURVIX_CONFIG || {};
const supa = window.supabase;
let db = null, currentUser = null, isAdmin = false, allContent = [], activeCategory = 'all', authMode = 'login', commentContentId = null;
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validUrl = value => { try { const u = new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const toast = message => { const el=$('toast'); if(!el)return; el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); };
const showDialog = id => $(id)?.showModal();
const closeDialog = id => $(id)?.close();
const youtubeEmbed = value => {
  try { const u=new URL(value); let id=''; if(u.hostname.includes('youtu.be')) id=u.pathname.slice(1); else if(u.searchParams.get('v')) id=u.searchParams.get('v'); else if(u.pathname.includes('/embed/')) id=u.pathname.split('/embed/')[1]; return id ? 'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id) : ''; } catch { return ''; }
};
function parseExtraLinks(raw) {
  return raw.split('\\n').map(line=>line.trim()).filter(Boolean).map(line=>{
    const pos=line.indexOf('|'); if(pos<0)return null;
    const label=line.slice(0,pos).trim(), url=validUrl(line.slice(pos+1).trim());
    return label && url ? {label,url} : null;
  }).filter(Boolean);
}
function extraLinksText(value) {
  if(Array.isArray(value)) return value.map(x=>`${x.label || 'Link'} | ${x.url || ''}`).join('\\n');
  return '';
}
function cardHTML(item) {
  const image=validUrl(item.image_url);
  const type=escapeHTML(item.type || 'post');
  return `<article class="content-card">
    <div class="thumb">${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy" onerror="this.remove()">` : `<div class="thumb-fallback">Q</div>`}<span class="type-tag">${type}</span></div>
    <div class="card-body"><span class="card-category">${escapeHTML(item.category || 'Discover')}</span>
    <h3 title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description || 'Explore this discovery on QURVIX.')}</p>
    <div class="card-actions"><button class="btn btn-red" data-view="${escapeHTML(item.id)}">View details ↗</button><button class="btn btn-quiet" data-comments="${escapeHTML(item.id)}">Comments</button></div></div></article>`;
}
function renderContent() {
  const q=($('searchInput')?.value || '').toLowerCase().trim();
  const filtered=allContent.filter(item=>{
    const categoryOK=activeCategory==='all' || (item.category||'').toLowerCase()===activeCategory.toLowerCase();
    const text=[item.title,item.category,item.description].join(' ').toLowerCase();
    return categoryOK && (!q || text.includes(q));
  });
  $('resultCount').textContent=`${filtered.length} item${filtered.length===1?'':'s'}`;
  $('contentGrid').innerHTML=filtered.length ? filtered.map(cardHTML).join('') : '<div class="empty">No content found. Try another category or search.</div>';
  renderFilters();
  renderAdminList();
}
function renderFilters() {
  const cats=[...new Set(allContent.map(x=>x.category).filter(Boolean))].sort();
  $('categoryFilters').innerHTML=`<button class="filter ${activeCategory==='all'?'active':''}" data-category="all">All</button>`+cats.map(c=>`<button class="filter ${activeCategory.toLowerCase()===c.toLowerCase()?'active':''}" data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join('');
}
async function loadContent() {
  if(!db){$('contentGrid').innerHTML='<div class="empty">Supabase setup missing. Check config.js and refresh.</div>';return;}
  const {data,error}=await db.from('content').select('*').order('created_at',{ascending:false});
  if(error){$('contentGrid').innerHTML='<div class="empty">Could not load content. Check Supabase table permissions and setup.</div>';console.error(error);return;}
  allContent=data||[]; renderContent();
}
function openDetails(id) {
  const item=allContent.find(x=>String(x.id)===String(id)); if(!item)return;
  const image=validUrl(item.image_url), video=youtubeEmbed(item.youtube_url), main=validUrl(item.url);
  const extras=Array.isArray(item.extra_links)?item.extra_links:[];
  $('detailContent').innerHTML=`<p class="overline">${escapeHTML(item.category||'DISCOVER')} · ${escapeHTML(item.type||'POST')}</p><h2>${escapeHTML(item.title)}</h2>${image?`<img class="detail-image" src="${escapeHTML(image)}" alt="${escapeHTML(item.title)}">`:''}<p class="detail-description">${escapeHTML(item.description||'')}</p>${video?`<iframe class="video-frame" src="${escapeHTML(video)}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`:''}<div class="detail-links">${main?`<a class="btn btn-red" href="${escapeHTML(main)}" target="_blank" rel="noopener noreferrer">Open main link ↗</a>`:''}${extras.map(x=>{const u=validUrl(x.url);return u?`<a class="btn btn-quiet" href="${escapeHTML(u)}" target="_blank" rel="noopener noreferrer">${escapeHTML(x.label||'Open link')} ↗</a>`:''}).join('')}</div><button class="btn btn-quiet" data-comments="${escapeHTML(item.id)}">View comments</button>`;
  showDialog('detailDialog');
}
async function loadComments(id) {
  commentContentId=id;
  const item=allContent.find(x=>String(x.id)===String(id));
  $('commentsTitle').textContent=item?`Comments · ${item.title}`:'Comments';
  $('commentsList').innerHTML='<p class="muted">Loading comments…</p>'; $('commentStatus').textContent='';
  showDialog('commentsDialog');
  const {data,error}=await db.from('comments').select('body,created_at,user_id').eq('content_id',id).eq('approved',true).order('created_at',{ascending:true});
  if(error){$('commentsList').innerHTML='<p class="muted">Comments are temporarily unavailable.</p>';return;}
  $('commentsList').innerHTML=(data||[]).length?(data||[]).map(c=>`<div class="comment"><strong>QURVIX member</strong><p>${escapeHTML(c.body)}</p></div>`).join(''):'<p class="muted">No comments yet. Start the conversation.</p>';
}
async function checkAdmin() {
  isAdmin=false;
  if(currentUser && db){
    const {data}=await db.from('profiles').select('role').eq('id',currentUser.id).maybeSingle();
    isAdmin=data?.role==='admin';
  }
  $('adminOpenBtn').classList.toggle('hidden',!isAdmin);
}
async function refreshAuth() {
  if(!db)return;
  const {data}=await db.auth.getSession(); currentUser=data.session?.user||null;
  $('loginBtn').classList.toggle('hidden',!!currentUser); $('signupBtn').classList.toggle('hidden',!!currentUser); $('logoutBtn').classList.toggle('hidden',!currentUser);
  await checkAdmin();
}
function setAuthMode(mode) {
  authMode=mode; $('authTitle').textContent=mode==='login'?'Welcome back':'Create your account';
  $('authSubmit').textContent=mode==='login'?'Sign in':'Create account';
  $('nameField').classList.toggle('hidden',mode==='login');
  $('authSwitch').textContent=mode==='login'?'New to QURVIX?':'Already have an account?';
  $('switchAuth').textContent=mode==='login'?'Create account':'Sign in';
}
async function saveContent(event) {
  event.preventDefault();
  if(!isAdmin){$('adminStatus').textContent='Admin access required.';return;}
  const id=$('editId').value;
  const payload={title:$('itemTitle').value.trim(),category:$('itemCategory').value.trim(),type:$('itemType').value,description:$('itemDescription').value.trim(),image_url:validUrl($('itemImage').value),youtube_url:validUrl($('itemYoutube').value),url:validUrl($('itemUrl').value),extra_links:parseExtraLinks($('itemExtraLinks').value),published:true};
  if(!payload.title||!payload.category){$('adminStatus').textContent='Title and category are required.';return;}
  const query=id?db.from('content').update(payload).eq('id',id):db.from('content').insert(payload);
  const {error}=await query;
  if(error){$('adminStatus').textContent=error.message;return;}
  $('adminStatus').textContent='Saved successfully.'; $('contentForm').reset(); $('editId').value='';
  await loadContent(); toast('Content saved'); 
}
function renderAdminList() {
  if(!$('adminList'))return;
  if(!isAdmin){$('adminList').innerHTML='';return;}
  $('adminList').innerHTML=allContent.length?allContent.map(x=>`<div class="admin-row"><span>${escapeHTML(x.title)}</span><div><button data-edit="${escapeHTML(x.id)}">Edit</button> <button data-delete="${escapeHTML(x.id)}">Delete</button></div></div>`).join(''):'<p class="muted">No content yet.</p>';
}
function editContent(id) {
  const x=allContent.find(v=>String(v.id)===String(id));if(!x)return;
  $('editId').value=x.id;$('itemTitle').value=x.title||'';$('itemCategory').value=x.category||'';$('itemType').value=x.type||'post';$('itemDescription').value=x.description||'';$('itemImage').value=x.image_url||'';$('itemYoutube').value=x.youtube_url||'';$('itemUrl').value=x.url||'';$('itemExtraLinks').value=extraLinksText(x.extra_links);
  $('adminStatus').textContent='Editing selected content.'; $('contentForm').scrollIntoView({behavior:'smooth'});
}
async function deleteContent(id) {
  if(!isAdmin || !confirm('Delete this content?'))return;
  const {error}=await db.from('content').delete().eq('id',id);
  if(error){toast(error.message);return;} await loadContent();toast('Content deleted');
}
async function init() {
  $('year').textContent=new Date().getFullYear();
  if(!supa || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY){$('contentGrid').innerHTML='<div class="empty">Supabase setup missing. Please check config.js.</div>';return;}
  db=supa.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  $('loginBtn').addEventListener('click',()=>{setAuthMode('login');showDialog('authDialog')});
  $('signupBtn').addEventListener('click',()=>{setAuthMode('signup');showDialog('authDialog')});
  $('logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();await refreshAuth();toast('Logged out')});
  $('switchAuth').addEventListener('click',()=>setAuthMode(authMode==='login'?'signup':'login'));
  $('authForm').addEventListener('submit',async e=>{
    e.preventDefault();$('authStatus').textContent='Please wait…';
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    let result;
    if(authMode==='login') result=await db.auth.signInWithPassword({email,password});
    else result=await db.auth.signUp({email,password,options:{data:{display_name:$('displayName').value.trim()}}});
    if(result.error){$('authStatus').textContent=result.error.message;return;}
    $('authStatus').textContent=authMode==='signup'?'Account created. Check your email if confirmation is required.':'Signed in successfully.';
    await refreshAuth(); if(authMode==='login')setTimeout(()=>closeDialog('authDialog'),500);
  });
  $('adminOpenBtn').addEventListener('click',()=>{renderAdminList();showDialog('adminDialog')});
  $('contentForm').addEventListener('submit',saveContent);
  $('resetContent').addEventListener('click',()=>{$('contentForm').reset();$('editId').value='';$('adminStatus').textContent=''});
  $('searchInput').addEventListener('input',renderContent);
  $('categoryFilters').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){activeCategory=b.dataset.category;renderContent()}});
  $('commentsList').addEventListener('click',()=>{});
  $('commentForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!currentUser){$('commentStatus').textContent='Please sign in to comment.';return;}
    const body=$('commentText').value.trim();if(!body)return;
    const {error}=await db.from('comments').insert({content_id:commentContentId,user_id:currentUser.id,body,approved:true});
    if(error){$('commentStatus').textContent=error.message;return;}
    $('commentText').value='';$('commentStatus').textContent='Comment posted.';await loadComments(commentContentId);
  });
  document.addEventListener('click',e=>{
    const close=e.target.closest('[data-close]');if(close){closeDialog(close.dataset.close);return;}
    const view=e.target.closest('[data-view]');if(view){openDetails(view.dataset.view);return;}
    const comments=e.target.closest('[data-comments]');if(comments){closeDialog('detailDialog');loadComments(comments.dataset.comments);return;}
    const edit=e.target.closest('[data-edit]');if(edit){editContent(edit.dataset.edit);return;}
    const del=e.target.closest('[data-delete]');if(del){deleteContent(del.dataset.delete);return;}
    const quick=e.target.closest('[data-quick]');if(quick){activeCategory=quick.dataset.quick;renderContent();return;}
  });
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
  await refreshAuth();await loadContent();
  db.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));
}
document.addEventListener('DOMContentLoaded',init);
})();