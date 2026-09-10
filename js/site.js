// Progressive enhancement only. The page is complete without this file.

(function () {
  'use strict';

  // --- Highlight the section currently in view in the sidebar nav ---
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && targets.length) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) current = e.target.id; });
      links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + current); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }

  // --- Stars and last push on the software cards, from the GitHub API ---
  // Unauthenticated: 60 requests per hour per IP, six cards, fails quietly.
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card.sw[href*="github.com/"]'));
  function ago(iso) {
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    var months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? ' month ago' : ' months ago');
    var years = Math.floor(days / 365);
    return years + (years === 1 ? ' year ago' : ' years ago');
  }
  function showFacts(card, stars, pushedAt, commits) {
    var line = document.createElement('span');
    line.className = 'mono small repo-meta';
    var text = '\u2605 ' + stars;
    if (commits > 0) text += ' \u00b7 ' + commits + ' commits by me';
    text += ' \u00b7 updated ' + ago(pushedAt);
    line.textContent = text;
    card.appendChild(line);
  }
  function fromApi(card, repo) {
    fetch('https://api.github.com/repos/' + repo)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { showFacts(card, d.stargazers_count, d.pushed_at); })
      .catch(function () { /* rate-limited or offline: leave the card as it is */ });
  }
  // data/repos.json is refreshed daily by a GitHub Action; the live API is the fallback.
  fetch('data/repos.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (facts) {
      cards.forEach(function (card) {
        var m = card.getAttribute('href').match(/github\.com\/([^\/]+\/[^\/]+)/);
        if (!m) return;
        var f = facts[m[1]];
        if (f && typeof f.stars === 'number' && f.pushed_at) showFacts(card, f.stars, f.pushed_at, f.commits || 0);
        else fromApi(card, m[1]);
      });
    });

  // --- Full journal-article list from the ORCID public API, on demand ---
  var details = document.getElementById('orcid-all');
  if (!details) return;
  var ORCID = '0000-0001-9515-3322';
  var loaded = false;

  // ORCID summaries carry no author lists; Crossref does, keyed by DOI.
  function addAuthors(target, doi, year) {
    fetch('https://api.crossref.org/works/' + encodeURIComponent(doi))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (res) {
        var names = ((res.message && res.message.author) || []).map(function (p) { return p.family || p.name || ''; }).filter(Boolean);
        if (!names.length) return;
        var shown = names.length > 6 ? names.slice(0, 5) : names;
        var me = names.indexOf('Streffing');
        var esc = function (t) { return t.replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
        var parts = shown.map(function (n) { return n === 'Streffing' ? '<strong>Streffing</strong>' : esc(n); });
        var text = parts.join(', ');
        if (names.length > 6) text += ' et al.' + (me >= 5 ? ' incl. <strong>Streffing</strong>' : '');
        target.innerHTML = text + ' (' + year + '). ';
      })
      .catch(function () { /* leave the title without authors */ });
  }

  details.addEventListener('toggle', function () {
    if (!details.open || loaded) return;
    loaded = true;
    var status = details.querySelector('.status');
    var list = details.querySelector('ol');

    fetch('https://pub.orcid.org/v3.0/' + ORCID + '/works', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var items = (data.group || []).map(function (g) {
          var w = g['work-summary'] && g['work-summary'][0];
          if (!w || w.type !== 'journal-article') return null;
          var year = w['publication-date'] && w['publication-date'].year ? w['publication-date'].year.value : '';
          var title = w.title && w.title.title ? w.title.title.value : '';
          var journal = w['journal-title'] ? w['journal-title'].value : '';
          var doi = '';
          var ids = (w['external-ids'] && w['external-ids']['external-id']) || [];
          ids.forEach(function (id) { if (id['external-id-type'] === 'doi') doi = id['external-id-value']; });
          return { year: year, title: title, journal: journal, doi: doi };
        }).filter(Boolean);

        items.sort(function (a, b) { return (b.year || '0').localeCompare(a.year || '0'); });

        if (!items.length) { status.textContent = 'Nothing returned from ORCID.'; return; }
        items.forEach(function (it) {
          var li = document.createElement('li');
          li.className = 'pub';
          var y = document.createElement('span'); y.className = 'mono year'; y.textContent = it.year;
          var d = document.createElement('div');
          var a = document.createElement(it.doi ? 'a' : 'span');
          if (it.doi) a.href = 'https://doi.org/' + it.doi;
          var authors = document.createElement('span'); authors.className = 'authors';
          a.appendChild(authors);
          a.appendChild(document.createTextNode(it.title));
          d.appendChild(a);
          if (it.journal) { var v = document.createElement('span'); v.className = 'venue'; v.textContent = it.journal; d.appendChild(v); }
          li.appendChild(y); li.appendChild(d); list.appendChild(li);
          if (it.doi) addAuthors(authors, it.doi, it.year);
        });
        status.hidden = true; list.hidden = false;
      })
      .catch(function () {
        status.innerHTML = 'Could not reach ORCID from here. <a href="https://orcid.org/' + ORCID + '">Open the record on orcid.org</a>.';
      });
  });
})();
