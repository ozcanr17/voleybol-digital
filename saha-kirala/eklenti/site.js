// voleybol.digital üzerinde çalışır ve "buradayım" der.
//
// Tanıtım sayfası eklentinin kurulu olup olmadığını başka türlü anlayamaz:
// bir web sayfası tarayıcıya kurulu eklentileri sorgulayamaz. Ama content
// script'ler sayfanın DOM'una yazabiliyor --- iki taraf bu şekilde
// haberleşiyor. Hiçbir kişisel veri paylaşılmaz, yalnızca sürüm bilgisi.

(() => {
  "use strict";

  const surum = chrome.runtime.getManifest().version;

  function isaretle() {
    const kok = document.documentElement;
    if (!kok) return;
    kok.setAttribute("data-saha-kirala-eklenti", surum);
    // Sayfa document_start'ta dinlemeye başlamış olabilir de olmayabilir de;
    // hem öznitelik hem olay gönderiyoruz ki hangisi önce olursa olsun görsün.
    window.dispatchEvent(new CustomEvent("saha-kirala-eklenti", {
      detail: { surum },
    }));
  }

  isaretle();
  document.addEventListener("DOMContentLoaded", isaretle);

  // Sayfa sonradan sorarsa da cevap ver.
  window.addEventListener("saha-kirala-sor", isaretle);
})();
