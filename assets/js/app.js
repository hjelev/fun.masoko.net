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

  /* ---------- Search index (loaded on demand) ---------- */
  var search = document.getElementById("search");
  var grid   = document.getElementById("grid");
  var results = document.getElementById("results");
  var status = document.getElementById("status");
  var empty  = document.getElementById("empty");
  var pager  = document.querySelector(".pagination");
  var randomBtn = document.getElementById("random");

  var indexPromise = null;
  function loadIndex() {
    if (indexPromise) return indexPromise;
    var url = (search && search.getAttribute("data-index")) || "/search.json";
    indexPromise = fetch(url).then(function (r) { return r.json(); });
    return indexPromise;
  }

  function plural(n) { return n === 1 ? "виц" : "вица"; }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Mirrors _includes/joke-card.html so search results look identical.
  function cardHtml(j) {
    var title = (j.title && j.title !== "Виц")
      ? '<h2 class="card-title">' + escapeHtml(j.title) + "</h2>" : "";
    var tags = (j.tags || []).map(function (t) {
      return '<span class="tag tag-plain">#' + escapeHtml(t) + "</span>";
    }).join("");
    return '<article class="card" data-cat="' + escapeHtml(j.category) + '">' +
      title +
      '<div class="card-body">' + j.html + "</div>" +
      '<div class="card-meta">' +
        '<a class="tag" href="/c/' + encodeURIComponent(j.category) + '/">' + escapeHtml(j.category_name) + "</a>" +
        tags +
        '<a class="permalink" href="' + escapeHtml(j.url) + '" title="Връзка към този виц" aria-label="Постоянна връзка">#</a>' +
      "</div></article>";
  }

  function showBrowse() {
    if (results) { results.hidden = true; results.innerHTML = ""; }
    if (grid)  grid.hidden = false;
    if (pager) pager.hidden = false;
    if (empty) empty.hidden = true;
    if (status) status.textContent = "";
  }

  function runSearch(raw) {
    var q = (raw || "").toLowerCase().trim();
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
      if (results) {
        results.hidden = false;
        results.innerHTML = matches.map(cardHtml).join("");
      }
      if (empty) empty.hidden = matches.length !== 0;
      if (status) status.textContent = matches.length + " " + plural(matches.length);
    });
  }

  if (search) {
    search.addEventListener("input", function () { runSearch(search.value); });
  }

  /* ---------- Random joke: jump to a random joke page ---------- */
  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      loadIndex().then(function (idx) {
        if (!idx.length) return;
        var pick = idx[Math.floor(Math.random() * idx.length)];
        window.location.href = pick.url;
      });
    });
  }
})();
