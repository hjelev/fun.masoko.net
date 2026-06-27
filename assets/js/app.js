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

  /* ---------- Search + category filtering ---------- */
  var search = document.getElementById("search");
  var grid   = document.getElementById("grid");
  var status = document.getElementById("status");
  var empty  = document.getElementById("empty");
  var chips  = document.getElementById("chips");
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var state = { q: "", cat: "all", random: null };

  function normalize(s) { return (s || "").toLowerCase().trim(); }

  function apply() {
    var q = normalize(state.q);
    var terms = q ? q.split(/\s+/) : [];
    var shown = 0;

    cards.forEach(function (card) {
      var visible;
      if (state.random) {
        visible = card === state.random;
      } else {
        var okCat = state.cat === "all" || card.getAttribute("data-cat") === state.cat;
        var hay = card.getAttribute("data-search") || "";
        var okQ = terms.every(function (t) { return hay.indexOf(t) !== -1; });
        visible = okCat && okQ;
      }
      card.hidden = !visible;
      if (visible) shown++;
    });

    empty.hidden = shown !== 0 || !!state.random;

    if (state.random) {
      status.textContent = "";
    } else if (q || state.cat !== "all") {
      status.textContent = shown + " " + plural(shown);
    } else {
      status.textContent = "";
    }
  }

  function plural(n) {
    return n === 1 ? "виц" : "вица";
  }

  function setActiveChip(cat) {
    if (!chips) return;
    chips.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("is-active", c.getAttribute("data-cat") === cat);
    });
  }

  if (search) {
    search.addEventListener("input", function () {
      state.q = search.value;
      state.random = null;
      apply();
    });
  }

  if (chips) {
    chips.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      state.cat = chip.getAttribute("data-cat");
      state.random = null;
      setActiveChip(state.cat);
      apply();
    });
  }

  // Click a category tag inside a card to filter by it.
  grid.addEventListener("click", function (e) {
    var tag = e.target.closest(".tag[data-cat]");
    if (!tag) return;
    e.preventDefault();
    state.cat = tag.getAttribute("data-cat");
    state.q = ""; if (search) search.value = "";
    state.random = null;
    setActiveChip(state.cat);
    apply();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- Random joke ---------- */
  var randomBtn = document.getElementById("random");
  if (randomBtn) {
    randomBtn.addEventListener("click", function () {
      // pick from cards matching the current category (ignoring the search box)
      var pool = cards.filter(function (c) {
        return state.cat === "all" || c.getAttribute("data-cat") === state.cat;
      });
      if (!pool.length) pool = cards;
      var pick = pool[Math.floor(Math.random() * pool.length)];

      state.random = null;
      state.q = ""; if (search) search.value = "";
      apply(); // show the full (category-filtered) list again

      pick.hidden = false;
      pick.classList.remove("flash");
      void pick.offsetWidth; // restart animation
      pick.classList.add("flash");
      pick.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  /* ---------- Honor ?cat=<slug> from permalinks ---------- */
  try {
    var p = new URLSearchParams(window.location.search).get("cat");
    if (p) {
      var exists = chips && chips.querySelector('.chip[data-cat="' + p + '"]');
      if (exists) { state.cat = p; setActiveChip(p); }
    }
  } catch (e) {}

  apply();
})();
