(function () {
  try {
    var t = localStorage.getItem('rt-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
