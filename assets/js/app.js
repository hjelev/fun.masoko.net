(function () {
  "use strict";

  /* ---------- Theme toggle (system default + manual override) ---------- */
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  function systemDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function currentTheme() {
    return root.getAttribute("data-theme") || (systemDark() ? "dark" : "light");
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }
  // Follow the OS if the user has not pinned a preference.
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      try { if (!localStorage.getItem("theme")) root.removeAttribute("data-theme"); } catch (e) {}
    });
  }

  /* ---------- Toast ---------- */
  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-visible"); }, 2200);
  }

  /* ---------- Search index (loaded on demand) ---------- */
  var search = document.getElementById("search");
  var grid   = document.getElementById("grid");
  var results = document.getElementById("results");
  var status = document.getElementById("status");
  var empty  = document.getElementById("empty");
  var pager  = document.querySelector(".pagination");
  var daily  = document.getElementById("daily");

  var indexPromise = null;
  function loadIndex() {
    if (indexPromise) return indexPromise;
    var src = document.querySelector("[data-index]");
    var url = (src && src.getAttribute("data-index")) || "/search.json";
    indexPromise = fetch(url).then(function (r) { return r.json(); });
    return indexPromise;
  }

  function plural(n) { return n === 1 ? "виц" : "вица"; }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Same markup as _includes/icon.html.
  var ICONS = {
    heart: '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.3s-7.3-4.4-9.3-8.9C1.4 8.3 3.4 4.8 6.8 4.8c2.1 0 3.6 1.2 4.4 2.6h1.6c.8-1.4 2.3-2.6 4.4-2.6 3.4 0 5.4 3.5 4.1 6.6-2 4.5-9.3 8.9-9.3 8.9z"/></svg>',
    share: '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/></svg>',
    link: '<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>'
  };

  // Mirrors _includes/joke-card.html so search results look identical.
  function cardHtml(j, extraClass) {
    var title = (j.title && j.title !== "Виц")
      ? '<h2 class="card-title"><a href="' + escapeHtml(j.url) + '">' + escapeHtml(j.title) + "</a></h2>" : "";
    var tags = (j.tags || []).map(function (t) {
      return '<span class="tag tag-plain">#' + escapeHtml(t) + "</span>";
    }).join("");
    var emoji = j.emoji ? '<span aria-hidden="true">' + escapeHtml(j.emoji) + "</span> " : "";
    return '<article class="card' + (extraClass ? " " + extraClass : "") + '" data-cat="' + escapeHtml(j.category) +
        '" data-url="' + escapeHtml(j.url) + '" data-title="' + escapeHtml(j.title) + '">' +
      title +
      '<div class="card-body">' + j.html + "</div>" +
      '<div class="card-meta">' +
        '<a class="tag" href="/c/' + encodeURIComponent(j.category) + '/">' + emoji + escapeHtml(j.category_name) + "</a>" +
        tags +
        '<span class="card-actions">' +
          '<button class="act fav-btn" type="button" aria-pressed="false" aria-label="Добави в любими" title="Любими">' + ICONS.heart + "</button>" +
          '<button class="act share-btn" type="button" aria-label="Сподели" title="Сподели">' + ICONS.share + "</button>" +
          '<a class="act permalink" href="' + escapeHtml(j.url) + '" title="Връзка към този виц" aria-label="Постоянна връзка">' + ICONS.link + "</a>" +
        "</span>" +
      "</div></article>";
  }

  // Add a "…" expander to any clamped card whose text overflows 3 lines.
  function setupClamp(scope) {
    var cards = (scope || document).querySelectorAll(".card:not(.card-single)");
    Array.prototype.forEach.call(cards, function (card) {
      var body = card.querySelector(".card-body");
      if (!body || card.classList.contains("is-expanded")) return;
      if (body.querySelector(".card-more")) return;
      if (body.scrollHeight - body.clientHeight <= 1) return;
      var btn = document.createElement("button");
      btn.className = "card-more";
      btn.type = "button";
      btn.setAttribute("aria-label", "Прочети целия виц");
      btn.textContent = "…";
      btn.addEventListener("click", function () {
        card.classList.add("is-expanded");
        btn.remove();
      });
      body.appendChild(btn);
    });
  }

  /* ---------- Favorites (kept in this browser only) ---------- */
  function readFavs() {
    try {
      var v = JSON.parse(localStorage.getItem("favs") || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  function writeFavs(list) {
    try { localStorage.setItem("favs", JSON.stringify(list)); } catch (e) {}
  }
  function syncFavs(scope) {
    var favs = readFavs();
    var btns = (scope || document).querySelectorAll(".fav-btn");
    Array.prototype.forEach.call(btns, function (btn) {
      var card = btn.closest(".card");
      var on = !!card && favs.indexOf(card.getAttribute("data-url")) !== -1;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Премахни от любими" : "Добави в любими");
    });
    var badge = document.querySelector(".fav-count");
    if (badge) {
      badge.textContent = favs.length;
      badge.hidden = favs.length === 0;
    }
  }

  /* ---------- Share: native sheet when available, else copy ---------- */
  function cardText(card) {
    var body = card.querySelector(".card-body");
    if (!body) return "";
    var clone = body.cloneNode(true);
    var more = clone.querySelector(".card-more");
    if (more) more.remove();
    return (clone.innerText || clone.textContent || "").trim();
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      ok ? resolve() : reject();
    });
  }
  function shareCard(card) {
    var url = new URL(card.getAttribute("data-url") || location.pathname, location.href).href;
    var title = card.getAttribute("data-title") || document.title;
    var text = cardText(card);
    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function () {});
      return;
    }
    copyText(text + "\n\n" + url).then(
      function () { toast("Вицът е копиран 📋"); },
      function () { toast("Неуспешно копиране"); }
    );
  }

  /* ---------- Random joke: jump to a random joke page ---------- */
  function goRandom() {
    loadIndex().then(function (idx) {
      if (!idx.length) return;
      var pick;
      do { pick = idx[Math.floor(Math.random() * idx.length)]; }
      while (idx.length > 1 && pick.url === location.pathname);
      window.location.href = pick.url;
    });
  }

  // One delegated handler covers server-rendered and JS-rendered cards alike.
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var fav = t.closest(".fav-btn");
    if (fav) {
      var card = fav.closest(".card");
      var url = card && card.getAttribute("data-url");
      if (!url) return;
      var favs = readFavs();
      var i = favs.indexOf(url);
      if (i === -1) { favs.unshift(url); toast("Добавен в любими ❤️"); }
      else { favs.splice(i, 1); toast("Премахнат от любими"); }
      writeFavs(favs);
      syncFavs();
      if (document.getElementById("fav-grid") && i !== -1) renderFavorites();
      return;
    }
    var share = t.closest(".share-btn");
    if (share) { shareCard(share.closest(".card")); return; }
    if (t.closest("[data-random]")) { goRandom(); }
  });

  /* ---------- Search ---------- */
  // Wrap every occurrence of the search terms in <mark>, touching text nodes only.
  function highlight(scope, terms) {
    var re = new RegExp("(" + terms.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("|") + ")", "gi");
    var nodes = [];
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      var n = walker.currentNode;
      if (n.parentNode.closest(".card-actions, .tag")) continue;
      re.lastIndex = 0;
      if (re.test(n.nodeValue)) nodes.push(n);
    }
    nodes.forEach(function (n) {
      var frag = document.createDocumentFragment();
      n.nodeValue.split(re).forEach(function (part, k) {
        if (!part) return;
        if (k % 2) {
          var m = document.createElement("mark");
          m.textContent = part;
          frag.appendChild(m);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
      });
      n.parentNode.replaceChild(frag, n);
    });
  }

  function setQueryParam(q) {
    try {
      var u = new URL(location.href);
      if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  function showBrowse() {
    if (results) { results.hidden = true; results.innerHTML = ""; }
    if (grid)  grid.hidden = false;
    if (pager) pager.hidden = false;
    if (daily) daily.hidden = !daily.querySelector(".card");
    if (empty) empty.hidden = true;
    if (status) status.textContent = "";
  }

  function runSearch(raw) {
    var q = (raw || "").toLowerCase().trim();
    setQueryParam((raw || "").trim());
    if (!q) { showBrowse(); return; }
    loadIndex().then(function (idx) {
      // Guard against an out-of-date callback if the box was cleared meanwhile.
      if (search && search.value.toLowerCase().trim() !== q) return;
      var terms = q.split(/\s+/);
      var matches = idx.filter(function (j) {
        var hay = j.search || "";
        return terms.every(function (t) { return hay.indexOf(t) !== -1; });
      });
      if (grid)  grid.hidden = true;
      if (pager) pager.hidden = true;
      if (daily) daily.hidden = true;
      if (results) {
        results.hidden = false;
        results.innerHTML = matches.map(function (j) { return cardHtml(j); }).join("");
        highlight(results, terms);
        setupClamp(results);
        syncFavs(results);
      }
      if (empty) empty.hidden = matches.length !== 0;
      if (status) status.textContent = matches.length + " " + plural(matches.length);
    });
  }

  if (search) {
    var debounce = null;
    search.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { runSearch(search.value); }, 120);
    });
    search.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && search.value) {
        e.preventDefault();
        search.value = "";
        runSearch("");
      }
    });
    // Restore a shared / bookmarked search (?q=…).
    var initial = new URLSearchParams(location.search).get("q");
    if (initial) { search.value = initial; runSearch(initial); }
  }

  /* ---------- Joke of the day (same pick for everyone on a given day) ---------- */
  if (daily) {
    loadIndex().then(function (all) {
      // Keep the front page family-friendly.
      var idx = all.filter(function (j) { return j.category !== "adults"; });
      if (!idx.length) return;
      var d = new Date();
      var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
      // Spread consecutive days across the collection instead of walking it in order.
      var pick = idx[(day * 7919) % idx.length];
      document.getElementById("daily-slot").innerHTML = cardHtml(pick, "card-daily is-expanded");
      syncFavs(daily);
      if (!search || !search.value.trim()) daily.hidden = false;
    });
  }

  /* ---------- Favorites page ---------- */
  function renderFavorites() {
    var favGrid = document.getElementById("fav-grid");
    var favEmpty = document.getElementById("fav-empty");
    var favs = readFavs();
    if (!favs.length) {
      favGrid.innerHTML = "";
      favEmpty.hidden = false;
      return;
    }
    loadIndex().then(function (idx) {
      var byUrl = {};
      idx.forEach(function (j) { byUrl[j.url] = j; });
      var list = favs.map(function (u) { return byUrl[u]; }).filter(Boolean);
      favGrid.innerHTML = list.map(function (j) { return cardHtml(j); }).join("");
      favEmpty.hidden = list.length !== 0;
      setupClamp(favGrid);
      syncFavs(favGrid);
    });
  }
  if (document.getElementById("fav-grid")) renderFavorites();

  /* ---------- Keyboard shortcuts ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var el = document.activeElement;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    if (typing) return;
    if (e.key === "/" && search) {
      e.preventDefault();
      search.focus();
      search.select();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      var link = document.querySelector('a[rel="' + (e.key === "ArrowLeft" ? "prev" : "next") + '"]');
      if (link) window.location.href = link.href;
    }
  });

  /* ---------- Back to top ---------- */
  var toTop = document.getElementById("to-top");
  if (toTop) {
    var onScroll = function () { toTop.hidden = window.scrollY < 600; };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  syncFavs();

  /* ---------- Clamp jokes to 3 lines with a "…" expander ---------- */
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    setupClamp(document);
  });
})();
