// 最初の描画の前に（<head> で同期に読む）、動かしてよいかを <html> に書く。CSS はこの印を見て組み方を変える。
//   m   … 動かしてよい（JS あり・「視差効果を減らす」でない）。舞台の高さもこの時点で CSS が決める
//   sda … CSS のスクロール連動（animation-timeline）が使える。?nosda で代わりの動きを試せる
// 本体（fuchidori.js）が読めなかった・止まったときは、印を外して止まった紙面に戻す。
(() => {
  const r = document.documentElement;
  r.classList.add('js');
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    r.classList.add('m');
    if (!/[?&]nosda\b/.test(location.search) && window.CSS && CSS.supports('animation-timeline: view()')) r.classList.add('sda');
    // defer の本体は DOMContentLoaded の前に動く。その時点で合図（m-ok）が無ければ、読み込みに失敗している
    document.addEventListener('DOMContentLoaded', () => {
      if (!r.classList.contains('m-ok')) r.classList.remove('m', 'sda');
    });
  } catch (e) {
    r.classList.remove('m', 'sda');
  }
})();
