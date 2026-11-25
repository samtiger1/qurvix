
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const cfg = window.QURVIX_CONFIG || {};
  const supabaseLib = window.supabase;

  const configured =
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    typeof cfg.SUPABASE_ANON_KEY === "string" &&
    cfg.SUPABASE_ANON_KEY.length > 10 &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_");

  const db = configured && supabaseLib
    ? supabaseLib.createClient(
        cfg.SUPABASE_URL,
        cfg.SUPABASE_ANON_KEY
      )
    : null;

  let session = null;
  let currentItems = [];
  let selectedCategory = "All";
  let currentCommentItem = null;
  let authMode = "login";
  let adminChecked = false;

  const categories = [
    "All",
    "Gaming",
    "Technology",
    "Entertainment",
    "News",
    "Tools",
    "Knowledge"
  ];

  const esc = (value = "") =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function showMessage(elementId, message) {
    const element = $(elementId);
    if (element) element.textContent = message;
  }

  function showError(error, location) {
    const message =
      error?.message ||
      error?.details ||
      String(error || "Unknown error");

    console.error("QURVIX " + location + ":", error);

    const fullMessage =
      "QURVIX " + location + " error: " + message +
      (error?.code ? " (Code: " + error.code + ")" : "");

    const toast = $("toast");
    if (toast) {
      toast.textContent = fullMessage;
      toast.classList.add("show");
    }

    return fullMessage;
  }

  function notify(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 4500);
  }

  const placeholder = [
    {
      id: "demo1",
      title: "Welcome to QURVIX",
      category: "Knowledge",
      description: "Your all-in-one destination is ready. Admins can publish the first stories from the dashboard.",
      type: "article",
      created_at: new Date().toISOString()
    },
    {
      id: "demo2",
      title: "Explore the latest in technology",
      category: "Technology",
      description: "Add your technology updates, explainers and useful discoveries here.",
      type: "article",
      created_at: new Date().toISOString()
    },
    {
      id: "demo3",
      title: "QURVIX Download Center",
      category: "Gaming",
      description: "Admin can add official game and app download links. Always link to trusted publishers.",
      type: "download",
      created_at: new Date().toISOString(),
      url: "#"
    }
  ];

  function itemCard(item) {
    const isDownload = item.type === "download";

    return `
      <article class="content-card">
        ${
          item.image_url
            ? `<img class="card-image" src="${esc(item.image_url)}" alt="" loading="lazy" onerror="this.remove()">`
            : `<div class="card-art">${esc((item.category || "Q").slice(0, 1))}</div>`
        }
        <div class="card-body">
          <span class="tag">${esc(item.category || "General")}</span>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.description)}</p>
          <div class="card-bottom">
            ${
              isDownload && item.url
                ? `<a class="small-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open download ↗</a>`
                : `<span class="muted">${new Date(item.created_at || Date.now()).toLocaleDateString()}</span>`
            }
            <button class="comment-link" data-comments="${esc(item.id)}">Comments</button>
          </div>
        </div>
      </article>
    `;
  }

  function render() {
    const search = $("searchInput")?.value.trim().toLowerCase() || "";

    const filtered = currentItems.filter((item) => {
      const categoryMatch =
        selectedCategory === "All" ||
        item.category === selectedCategory;

      const searchMatch =
        `${item.title || ""} ${item.description || ""} ${item.category || ""}`
          .toLowerCase()
          .includes(search);

      return categoryMatch && searchMatch;
    });

    const articles = filtered.filter((item) => item.type !== "download");
    const downloads = filtered.filter((item) => item.type === "download");

    if ($("contentGrid")) {
      $("contentGrid").innerHTML = articles.length
        ? articles.map(itemCard).join("")
        : `<div class="empty">No articles found yet. Check back soon.</div>`;
    }

    if ($("downloadGrid")) {
      $("downloadGrid").innerHTML = downloads.length
        ? downloads.map(itemCard).join("")
        : `<div class="empty">No downloads published yet.</div>`;
    }

    document.querySelectorAll("[data-comments]").forEach((button) => {
      button.onclick = () => openComments(button.dataset.comments);
    });
  }

  async function loadItems() {
    if (!db) {
      currentItems = placeholder;
      render();

      notify(
        !supabaseLib
          ? "Supabase library did not load. Check internet or script."
          : "Supabase configuration is missing. Check config.js."
      );
      return;
    }

    try {
      const { data, error } = await db
        .from("content")
        .select("id,title,category,type,description,image_url,url,published,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) {
        currentItems = placeholder;
        render();
        showError(error, "Content loading");
        return;
      }

      currentItems = data || [];
      render();

    } catch (error) {
      currentItems = placeholder;
      render();
      showError(error, "Content loading");
    }
  }

  function setUser(newSession) {
    session = newSession;

    const loggedIn = !!newSession?.user;

    $("loginBtn")?.classList.toggle("hidden", loggedIn);
    $("signupBtn")?.classList.toggle("hidden", loggedIn);
    $("logoutBtn")?.classList.toggle("hidden", !loggedIn);

    if (!loggedIn) {
      $("adminBtn")?.remove();
      adminChecked = false;
    } else {
      checkAdmin();
    }
  }

  async function checkAdmin() {
    if (!db || !session?.user || adminChecked) return;

    adminChecked = true;

    try {
      const { data, error } = await db
        .from("profiles")
        .select("role,display_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        adminChecked = false;
        showError(error, "Admin check");
        return;
      }

      if (data?.role === "admin") {
        if (!$("adminBtn")) {
          $("mainNav")?.insertAdjacentHTML(
            "beforeend",
            '<button class="nav-admin" id="adminBtn">Admin</button>'
          );
          $("adminBtn").onclick = openAdmin;
        }
      } else {
        $("adminBtn")?.remove();
      }

    } catch (error) {
      adminChecked = false;
      showError(error, "Admin check");
    }
  }

  function openAuth(mode) {
    authMode = mode;

    $("authTitle").textContent =
      mode === "login" ? "Login" : "Create account";

    $("authSubmit").textContent =
      mode === "login" ? "Login" : "Sign up";

    $("nameField").classList.toggle("hidden", mode === "login");

    $("authPassword").autocomplete =
      mode === "login" ? "current-password" : "new-password";

    $("authSwitch").innerHTML =
      mode === "login"
        ? 'New here? <button type="button" class="text-btn" id="switchAuth">Create an account</button>'
        : 'Already registered? <button type="button" class="text-btn" id="switchAuth">Login</button>';

    $("switchAuth").onclick = () =>
      openAuth(mode === "login" ? "signup" : "login");

    showMessage("authStatus", "");
    $("authDialog").showModal();
  }

  $("loginBtn").onclick = () => openAuth("login");
  $("signupBtn").onclick = () => openAuth("signup");

  $("authForm").onsubmit = async (event) => {
    event.preventDefault();

    if (!db) {
      showMessage("authStatus", "Supabase setup is missing. Check config.js.");
      return;
    }

    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    $("authSubmit").disabled = true;
    showMessage("authStatus", "Please wait...");

    try {
      let result;

      if (authMode === "login") {
        result = await db.auth.signInWithPassword({
          email,
          password
        });
      } else {
        result = await db.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: $("displayName").value.trim()
            },
            emailRedirectTo: window.location.origin + window.location.pathname
          }
        });
      }

      if (result.error) {
        showMessage("authStatus", result.error.message);
        return;
      }

      if (authMode === "signup" && !result.data.session) {
        showMessage(
          "authStatus",
          "Account created. Check your email to confirm, then log in."
        );
      } else {
        $("authDialog").close();
        notify("Welcome to QURVIX!");
        setUser(result.data.session);
      }

    } catch (error) {
      showMessage("authStatus", error.message || "Authentication failed.");
    } finally {
      $("authSubmit").disabled = false;
    }
  };

  $("logoutBtn").onclick = async () => {
    if (!db) return;

    const { error } = await db.auth.signOut();

    if (error) {
      showError(error, "Logout");
      return;
    }

    setUser(null);
    notify("Logged out.");
  };

  $("categories").onclick = (event) => {
    const button = event.target.closest("[data-cat]");
    if (!button) return;

    selectedCategory = button.dataset.cat;

    document.querySelectorAll(".chip").forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });

    render();
  };

  $("searchInput").oninput = render;

  async function openComments(id) {
    currentCommentItem = currentItems.find(
      (item) => String(item.id) === String(id)
    );

    if (!currentCommentItem) return;

    $("commentsTitle").textContent = currentCommentItem.title;
    $("commentsList").innerHTML =
      "<p class='muted'>Loading comments...</p>";

    showMessage("commentStatus", "");
    $("commentsDialog").showModal();

    if (!db) {
      $("commentsList").innerHTML =
        "<p class='muted'>Comments are unavailable until Supabase is connected.</p>";
      return;
    }

    try {
      const { data, error } = await db
        .from("comments")
        .select("id,body,created_at,user_id")
        .eq("content_id", currentCommentItem.id)
        .eq("approved", true)
        .order("created_at", { ascending: false });

      if (error) {
        $("commentsList").innerHTML =
          "<p class='muted'>Unable to load comments.</p>";
        showError(error, "Comments loading");
        return;
      }

      $("commentsList").innerHTML =
        (data || []).map((comment) => `
          <div class="comment">
            <b>QURVIX member</b>
            <p>${esc(comment.body)}</p>
            <small>${new Date(comment.created_at).toLocaleString()}</small>
          </div>
        `).join("") || "<p class='muted'>Be the first to comment.</p>";

    } catch (error) {
      $("commentsList").innerHTML =
        "<p class='muted'>Unable to load comments.</p>";
      showError(error, "Comments loading");
    }
  }

  $("commentForm").onsubmit = async (event) => {
    event.preventDefault();

    if (!session?.user) {
      showMessage("commentStatus", "Please log in before commenting.");
      return;
    }

    if (!currentCommentItem || !db) return;

    const body = $("commentText").value.trim();
    if (!body) return;

    try {
      const { error } = await db.from("comments").insert({
        content_id: currentCommentItem.id,
        user_id: session.user.id,
        body
      });

      if (error) {
        showMessage("commentStatus", error.message);
        return;
      }

      $("commentText").value = "";
      showMessage("commentStatus", "Comment submitted for moderation.");
      notify("Comment submitted.");

    } catch (error) {
      showMessage("commentStatus", error.message);
    }
  };

  async function openAdmin() {
    if (!session?.user) {
      notify("Please log in first.");
      return;
    }

    $("adminDialog").showModal();
    await loadAdminList();
  }

  async function loadAdminList() {
    if (!db) return;

    $("adminList").innerHTML = "<p>Loading content...</p>";

    try {
      const { data, error } = await db
        .from("content")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        $("adminList").textContent = error.message;
        showError(error, "Admin content");
        return;
      }

      const items = data || [];

      $("adminList").innerHTML = items.map((item) => `
        <div class="admin-row">
          <div>
            <b>${esc(item.title)}</b>
            <small>${esc(item.category)} · ${item.published ? "Published" : "Draft"}</small>
          </div>
          <div>
            <button class="tiny-btn" data-edit="${esc(item.id)}">Edit</button>
            <button class="tiny-btn danger" data-delete="${esc(item.id)}">Delete</button>
          </div>
        </div>
      `).join("") || "<p class='muted'>No content yet.</p>";

      $("adminList").querySelectorAll("[data-edit]").forEach((button) => {
        button.onclick = () => {
          const item = items.find(
            (entry) => String(entry.id) === button.dataset.edit
          );

          if (!item) return;

          $("editId").value = item.id;
          $("itemTitle").value = item.title;
          $("itemCategory").value = item.category;
          $("itemType").value = item.type;
          $("itemDescription").value = item.description;
          $("itemImage").value = item.image_url || "";
          $("itemUrl").value = item.url || "";

          showMessage("adminStatus", "Editing: " + item.title);
        };
      });

      $("adminList").querySelectorAll("[data-delete]").forEach((button) => {
        button.onclick = async () => {
          if (!confirm("Delete this content?")) return;

          const { error } = await db
            .from("content")
            .delete()
            .eq("id", button.dataset.delete);

          if (error) {
            showError(error, "Delete content");
            return;
          }

          notify("Content deleted.");
          await loadAdminList();
          await loadItems();
        };
      });

    } catch (error) {
      $("adminList").textContent = error.message;
      showError(error, "Admin content");
    }
  }

  $("contentForm").onsubmit = async (event) => {
    event.preventDefault();

    if (!db || !session?.user) {
      showMessage("adminStatus", "Please log in as admin.");
      return;
    }

    const id = $("editId").value;

    const payload = {
      title: $("itemTitle").value.trim(),
      category: $("itemCategory").value,
      type: $("itemType").value,
      description: $("itemDescription").value.trim(),
      image_url: $("itemImage").value.trim() || null,
      url: $("itemUrl").value.trim() || null,
      published: true,
      updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.description) {
      showMessage("adminStatus", "Title and description are required.");
      return;
    }

    try {
      const result = id
        ? await db.from("content").update(payload).eq("id", id)
        : await db.from("content").insert(payload);

      if (result.error) {
        showMessage("adminStatus", result.error.message);
        showError(result.error, "Save content");
        return;
      }

      $("contentForm").reset();
      $("editId").value = "";

      showMessage("adminStatus", "Saved successfully.");
      notify("Content saved.");

      await loadAdminList();
      await loadItems();

    } catch (error) {
      showMessage("adminStatus", error.message);
      showError(error, "Save content");
    }
  };

  $("menuBtn").onclick = () => {
    $("mainNav").classList.toggle("open");
  };

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  async function startApp() {
    if (!db) {
      await loadItems();
      return;
    }

    try {
      const { data, error } = await db.auth.getSession();

      if (error) {
        showError(error, "Session");
      } else {
        setUser(data.session);
      }

      db.auth.onAuthStateChange((_event, newSession) => {
        setUser(newSession);
      });

    } catch (error) {
      showError(error, "Startup");
    }

    await loadItems();
  }

  startApp();

})();
