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
  // Eklenti yeniden yüklendiğinde/güncellendiğinde, o sırada AÇIK olan
  // sekmelerdeki bu betik "sahipsiz" kalır (extension context invalidated).
  // O hâlde chrome.runtime çağrıları ya senkron hata fırlatır ya da geri
  // çağırma hiç çalışmaz; sayfa da cevabı boşuna bekleyip zaman aşımıyla
  // "Eklenti yanıt vermedi" derdi. Sayfa hâlâ eski işaretleyiciyi gördüğü
  // için eklentiyi kurulu sanıyordu. Artık durumu anlayıp ne yapılacağını
  // söylüyoruz: sayfayı yenilemek yeni betiği yükler ve sorun biter.
  const sahipsiz = () => !(chrome.runtime && chrome.runtime.id);

  window.addEventListener("message", (olay) => {
    if (olay.source !== window) return;                  // başka çerçeve olmasın
    const d = olay.data;
    if (!d || d.kaynak !== SAYFADAN) return;

    const cevapla = (govde) => yolla(Object.assign({ istekId: d.istekId }, govde));

    if (sahipsiz()) {
      cevapla({ ok: false, hata: "Eklenti yeniden yüklendi. Bu sayfayı " +
                                 "yenileyin (Cmd/Ctrl + R), sonra tekrar deneyin." });
      return;
    }

    try {
      chrome.runtime.sendMessage({ komut: d.komut, is: d.is }, (cevap) => {
        const hata = chrome.runtime.lastError;
        cevapla({
          ok: !hata && cevap && cevap.ok,
          is: cevap && cevap.is,
          hata: hata ? hata.message : (cevap && cevap.hata),
        });
      });
    } catch (e) {
      cevapla({ ok: false, hata: "Eklentiye ulaşılamadı (" + e.message +
                                 "). Sayfayı yenileyin." });
    }
  });

  // ------------------------------------------- durum değişimlerini sayfaya it
  // Otomasyon spor.istanbul sekmesinde ilerledikçe depoyu güncelliyor; sayfanın
  // yoklama yapmasına gerek kalmasın diye değişimi buradan bildiriyoruz.
  chrome.storage.onChanged.addListener((degisen, alan) => {
    if (alan !== "local" || !degisen.is) return;
    yolla({ olay: "durum", is: degisen.is.newValue || null });
  });

  // Sayfa yeni açıldıysa mevcut durumu bir kez gönder. Servis çalışanı uykuda
  // olabilir; bu ilk mesaj onu uyandırır. Sahipsiz bağlamda sessizce geçiyoruz
  // --- kullanıcı ilk komutu verdiğinde zaten net bir uyarı alacak.
  if (!sahipsiz()) {
    try {
      chrome.runtime.sendMessage({ komut: "durum" }, (cevap) => {
        if (chrome.runtime.lastError) return;
        if (cevap && cevap.ok) yolla({ olay: "durum", is: cevap.is });
      });
    } catch { /* eklenti yeniden yüklenmiş; sayfa yenilenince düzelir */ }
  }
})();
