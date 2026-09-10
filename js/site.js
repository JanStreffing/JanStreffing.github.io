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

  // --- Full journal-article list from the ORCID public API, on demand ---
  var details = document.getElementById('orcid-all');
  if (!details) return;
  var ORCID = '0000-0001-9515-3322';
  var loaded = false;

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
          a.textContent = it.title;
          d.appendChild(a);
          if (it.journal) { var v = document.createElement('span'); v.className = 'venue'; v.textContent = it.journal; d.appendChild(v); }
          li.appendChild(y); li.appendChild(d); list.appendChild(li);
        });
        status.hidden = true; list.hidden = false;
      })
      .catch(function () {
        status.innerHTML = 'Could not reach ORCID from here. <a href="https://orcid.org/' + ORCID + '">Open the record on orcid.org</a>.';
      });
  });
})();
