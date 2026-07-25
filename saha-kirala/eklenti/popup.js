// Eklenti penceresi: yalnızca durum gösterir ve durdurma imkânı verir.
// Ayarlar ve başlatma arayüzde (voleybol.digital/saha-kirala).

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const iki = (n) => String(n).padStart(2, "0");
  const kacir = (s) => String(s).replace(/[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const ETIKET = {
    basliyor: "başlatılıyor", filtre: "filtreler seçiliyor",
    bekleme: "açılış bekleniyor", yoklama: "seans yoklanıyor",
    yakalandi: "seans yakalandı", form: "form dolduruluyor",
    sepet: "sepete ekleniyor", sms: "SMS bekleniyor",
    bitti: "tamamlandı", hata: "hata", durduruldu: "durduruldu",
  };
  const TON = {
    bitti: "ok", hata: "err", durduruldu: "warn", sms: "warn", yakalandi: "ok",
    bekleme: "run", yoklama: "run", form: "run", sepet: "run",
  };
  const CALISAN = new Set(["basliyor", "filtre", "bekleme", "yoklama",
                           "yakalandi", "form", "sepet", "sms"]);

  let acilisMs = null;

  function ciz(is) {
    const calisiyor = Boolean(is && is.aktif && CALISAN.has(is.durum));
    $("rozet").textContent = is ? (ETIKET[is.durum] || is.durum) : "boşta";
    $("rozet").className = "rozet " + (is ? (TON[is.durum] || "") : "");
    $("durdur").disabled = !calisiyor;

    $("hedef").textContent = is ? `${is.tesis} · ${is.tarih} ${is.saat}`
                                : "Henüz bir iş başlatılmadı.";

    $("kayit").innerHTML = (is && is.kayit && is.kayit.length)
      ? is.kayit.map((k) => `<span class="t">${k.t}</span>  ` +
          `<span class="${k.tur || ""}">${kacir(k.m)}</span>`).join("\n")
      : '<span class="t">—</span>';
    $("kayit").scrollTop = $("kayit").scrollHeight;

    acilisMs = is ? is.acilis : null;
  }

  function tik() {
    if (!acilisMs) { $("geri").textContent = "--:--:--"; return; }
    let f = Math.floor((acilisMs - Date.now()) / 1000);
    const isaret = f < 0 ? "+" : "";
    f = Math.abs(f);
    $("geri").textContent = isaret + iki(Math.floor(f / 3600)) + ":" +
      iki(Math.floor((f % 3600) / 60)) + ":" + iki(f % 60);
  }

  async function yenile() {
    const { is } = await chrome.storage.local.get("is");
    ciz(is || null);
  }

  $("durdur").onclick = () => {
    chrome.runtime.sendMessage({ komut: "durdur" }, () => yenile());
  };

  chrome.storage.onChanged.addListener(yenile);
  setInterval(tik, 250);
  yenile(); tik();
})();
