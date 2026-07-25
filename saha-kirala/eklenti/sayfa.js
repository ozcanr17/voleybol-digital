// SAYFA DÜNYASI (world: MAIN) — sitenin kendi JavaScript ortamında çalışır.
//
// Site rezervasyon adımında alert() kullanıyor ("Rezervasyon İşlemi
// Gerçekleştiriyorsunuz. Bilginize."). Bu kutu açıkken sayfadaki hiçbir şey
// ilerlemiyor ve otomasyon orada donuyor.
//
// İzole dünyadan sayfanın window.alert'ine erişilemez — content script'ler
// ayrı bir JavaScript ortamında çalışır. Bu yüzden bu dosya MAIN dünyasına
// enjekte ediliyor ve document_start'ta, yani sitenin kendi kodu çalışmadan
// önce alert'i devralıyor.

(() => {
  "use strict";

  const AD = "__sahaKiralaSonMesaj";

  for (const isim of ["alert", "confirm"]) {
    const orijinal = window[isim];
    window[isim] = function (mesaj) {
      try {
        // Mesajı izole dünyanın okuyabileceği bir yere bırak: DOM üzerinden
        // iki dünya haberleşebiliyor.
        document.documentElement.setAttribute(
          "data-saha-kirala-mesaj", String(mesaj == null ? "" : mesaj));
        window[AD] = mesaj;
      } catch (e) { /* sayfa henüz hazır değilse önemsiz */ }

      // confirm() için "Tamam" demek gerekiyor; alert zaten değer döndürmez.
      return isim === "confirm" ? true : undefined;
    };
    window[isim].__orijinal = orijinal;
  }
})();
