(function () {
  try {
    var t = localStorage.getItem('rt-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    var z = Number(localStorage.getItem('rt-zoom'));
    if (z >= 100 && z <= 200) document.documentElement.style.setProperty('--doc-size', String(z / 100));
  } catch (e) {}
})();
