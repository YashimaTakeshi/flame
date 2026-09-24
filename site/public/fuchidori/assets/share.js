// 「人に教える」のボタン。ページで動くスクリプトはこれだけ（CSP は script-src 'self'）。
// スマホは端末の共有シート（LINE・メッセージ・AirDrop など）を開く。出せない端末ではリンクをコピーする。
(() => {
  const box = document.querySelector('[data-share]');
  if (!box) return;
  const url = box.dataset.url;
  const text = box.dataset.text;
  const say = box.querySelector('.share__done');
  const native = box.querySelector('[data-act="native"]');
  const copy = box.querySelector('[data-act="copy"]');

  if (navigator.share) native.hidden = false;
  native.addEventListener('click', () => {
    navigator.share({ title: document.title, text, url }).catch(() => {});
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      say.textContent = box.dataset.copied;
    } catch {
      say.textContent = url;
    }
  });
})();
