(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  var toggleLabel = toggle ? toggle.querySelector('.theme-toggle-label') : null;
  var searchInput = document.getElementById('search-input');
  var noPostsFound = document.getElementById('no-posts-found');

  function setToggleState(theme) {
    if (!toggle) {
      return;
    }
    var isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    if (toggleLabel) {
      toggleLabel.textContent = isDark ? 'Light' : 'Dark';
    }
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

  if (searchInput) {
    searchInput.addEventListener('input', function (event) {
      var term = event.target.value.trim().toLowerCase();
      var cards = Array.prototype.slice.call(document.querySelectorAll('.post-card'));
      var visibleCount = 0;

      cards.forEach(function (card) {
        var haystack = [(card.dataset.title || ''), (card.dataset.tags || '')].join(' ');
        var matches = !term || haystack.indexOf(term) !== -1;
        card.classList.toggle('hidden', !matches);
        if (matches) {
          visibleCount += 1;
        }
      });

      if (noPostsFound) {
        noPostsFound.classList.toggle('hidden', visibleCount !== 0);
      }
    });
  }
}());
