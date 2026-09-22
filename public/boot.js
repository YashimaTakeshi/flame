/*
 * 公開し直すと、古い名前の部品（JS・CSS）は消える。
 * ブラウザが古い index.html を持ったままだと部品が 404 になり、
 * 題だけ出て真っ黒な画面になる（実機で発生。GitHub Pages は HTML を 10 分持つ）。
 * 部品の取りこぼしに気づいたら、一度だけ取り直す（問い合わせを付けてキャッシュを外す）。
 *
 * 束ねる前に動く必要があるので素の JS。名前に指紋を付けない（古い HTML からも同じ名前で届く）。
 * index.html の中に書かないのは CSP（script-src 'self'）のため。
 */
(function () {
  var KEY = 'fuchidori:stale-reload';
  var tried = false;
  function mounted() {
    var r = document.getElementById('root');
    return !!r && r.childElementCount > 0;
  }
  function recover() {
    if (tried || mounted()) return;
    tried = true;
    try {
      // 2度は繰り返さない（本当に壊れているときに往復し続けないため）
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch (e) {
      return;
    }
    location.replace(location.pathname + '?v=' + Date.now());
  }
  addEventListener(
    'error',
    function (e) {
      var t = e.target;
      if (t && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) recover();
    },
    true,
  );
  addEventListener('load', function () {
    setTimeout(function () {
      if (!mounted()) {
        recover();
        return;
      }
      try {
        sessionStorage.removeItem(KEY);
      } catch (e) {}
      // 取り直しの印を人に見せない
      if (/[?&]v=\d+/.test(location.search)) history.replaceState(null, '', location.pathname);
    }, 2500);
  });
})();
