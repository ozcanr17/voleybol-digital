// voleybol.digital ile eklenti arasındaki köprü.
//
// Arayüz sitede kalıyor; eklenti yalnızca motor. Sayfa doğrudan chrome.* API'sine
// erişemez (ayrı dünyalar), bu yüzden komutlar window.postMessage ile buraya
// geliyor, buradan da chrome.runtime üzerinden arka plana aktarılıyor.
//
// Güvenlik: bu betik yalnızca manifest'te izin verilen kendi alan adlarımızda
// çalışır ve sadece aynı pencereden gelen mesajları kabul eder.

(() => {
  "use strict";

  const SAYFADAN = "saha-kirala-sayfa";
  const EKLENTIDEN = "saha-kirala-eklenti";
  const surum = chrome.runtime.getManifest().version;

  // ------------------------------------------------------------- varlık
  function isaretle() {
    const kok = document.documentElement;
    if (!kok) return;
    kok.setAttribute("data-saha-kirala-eklenti", surum);
    window.dispatchEvent(new CustomEvent("saha-kirala-eklenti", { detail: { surum } }));
  }
  isaretle();
  document.addEventListener("DOMContentLoaded", isaretle);
  window.addEventListener("saha-kirala-sor", isaretle);

  const yolla = (govde) =>
    window.postMessage(Object.assign({ kaynak: EKLENTIDEN, surum }, govde), location.origin);

  // ------------------------------------------------- sayfadan gelen komutlar
  window.addEventListener("message", (olay) => {
    if (olay.source !== window) return;                  // başka çerçeve olmasın
    const d = olay.data;
    if (!d || d.kaynak !== SAYFADAN) return;

    chrome.runtime.sendMessage(
      { komut: d.komut, is: d.is },
      (cevap) => {
        const hata = chrome.runtime.lastError;
        yolla({
          istekId: d.istekId,
          ok: !hata && cevap && cevap.ok,
          is: cevap && cevap.is,
          hata: hata ? hata.message : (cevap && cevap.hata),
        });
      });
  });

  // ------------------------------------------- durum değişimlerini sayfaya it
  // Otomasyon spor.istanbul sekmesinde ilerledikçe depoyu güncelliyor; sayfanın
  // yoklama yapmasına gerek kalmasın diye değişimi buradan bildiriyoruz.
  chrome.storage.onChanged.addListener((degisen, alan) => {
    if (alan !== "local" || !degisen.is) return;
    yolla({ olay: "durum", is: degisen.is.newValue || null });
  });

  // Sayfa yeni açıldıysa mevcut durumu bir kez gönder.
  chrome.runtime.sendMessage({ komut: "durum" }, (cevap) => {
    if (chrome.runtime.lastError) return;
    if (cevap && cevap.ok) yolla({ olay: "durum", is: cevap.is });
  });
})();
