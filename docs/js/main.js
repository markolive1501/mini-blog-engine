(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  var toggleLabel = toggle ? toggle.querySelector('.theme-toggle-label') : null;
  var searchInput = document.getElementById('search-input');
  var noPostsFound = document.getElementById('no-posts-found');
  var loadMoreBtn = document.getElementById('load-more-btn');
  var signupForm = document.getElementById('signup-form');
  var signupFeedback = document.getElementById('signup-feedback');

  // ── Theme ──────────────────────────────────────────────────────────────────

  function setToggleState(theme) {
    if (!toggle) return;
    var isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    if (toggleLabel) toggleLabel.textContent = isDark ? 'Light' : 'Dark';
  }

  function applyTheme(theme) {
    var isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    setToggleState(isDark ? 'dark' : 'light');
  }

  setToggleState(root.classList.contains('dark') ? 'dark' : 'light');

  if (toggle) {
    toggle.addEventListener('click', function () {
      applyTheme(root.classList.contains('dark') ? 'light' : 'dark');
    });
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  if (searchInput) {
    searchInput.addEventListener('input', function (event) {
      var term = event.target.value.trim().toLowerCase();
      var cards = Array.prototype.slice.call(document.querySelectorAll('.post-card'));
      var visibleCount = 0;

      cards.forEach(function (card) {
        var haystack = [(card.dataset.title || ''), (card.dataset.tags || '')].join(' ');
        var matches = !term || haystack.indexOf(term) !== -1;
        card.classList.toggle('hidden', !matches);
        if (matches) visibleCount += 1;
      });

      if (noPostsFound) {
        noPostsFound.classList.toggle('hidden', visibleCount !== 0);
      }
    });
  }

  // ── Load More ───────────────────────────────────────────────────────────────

  var BATCH_SIZE = 9;
  var expanded = false;
  var allOverflowCards;

  if (loadMoreBtn) {
    allOverflowCards = Array.prototype.slice.call(
      document.querySelectorAll('[data-overflow="true"]')
    );

    // Start collapsed — hide everything beyond the first batch
    // The first 9 cards in the DOM include featured ones at the top,
    // so we count total visible non-overflow cards instead.
    // Simpler approach: just hide all overflow cards initially.
    allOverflowCards.forEach(function (card) {
      card.classList.add('hidden');
    });

    loadMoreBtn.addEventListener('click', function () {
      expanded = !expanded;

      if (expanded) {
        allOverflowCards.forEach(function (card) {
          card.classList.remove('hidden');
        });
        loadMoreBtn.textContent = 'Show less ↑';
      } else {
        allOverflowCards.forEach(function (card) {
          card.classList.add('hidden');
        });
        // Scroll back to the post list smoothly
        var postList = document.getElementById('post-list');
        if (postList) {
          postList.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        loadMoreBtn.textContent = 'Load more posts';
      }
    });
  }

  // ── Email Signup ────────────────────────────────────────────────────────────

  if (signupForm && signupFeedback) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var emailInput = document.getElementById('signup-email');
      var email = emailInput ? emailInput.value.trim() : '';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        signupFeedback.style.color = 'var(--accent)';
        signupFeedback.textContent = 'Please enter a valid email address.';
        return;
      }

      // For now, open mailto — backend can be wired up later
      signupFeedback.style.color = 'var(--accent)';
      signupFeedback.textContent = 'Coming soon — subscribe via RSS in the meantime!';
      signupForm.reset();
    });
  }
}());
