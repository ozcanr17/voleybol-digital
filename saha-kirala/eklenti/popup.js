// Eklenti penceresi: işi tanımlar, chrome.storage'a yazar, durumu gösterir.
// Asıl otomasyon icerik.js içinde, spor.istanbul sekmesinde çalışıyor.

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const iki = (n) => String(n).padStart(2, "0");
  const DAKIKALAR = ["00", "15", "30", "35"];
  const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const HATIRLA = ["brans", "tesis", "salon", "satisTuru"];

  const ETIKET = {
    bekleme: "açılış bekleniyor", yoklama: "seans yoklanıyor",
    yakalandi: "seans yakalandı", form: "form dolduruluyor",
    sepet: "sepete ekleniyor", sms: "SMS bekleniyor",
    bitti: "tamamlandı", hata: "hata",
  };
  const TON = {
    bitti: "ok", hata: "err", sms: "warn", yakalandi: "ok",
    bekleme: "run", yoklama: "run", form: "run", sepet: "run",
  };

  // ------------------------------------------------------------- kutular
  for (const s of ["basH", "bitH"]) {
    $(s).innerHTML = Array.from({ length: 24 }, (_, h) => `<option>${iki(h)}</option>`).join("");
  }
  for (const s of ["basD", "bitD"]) {
    $(s).innerHTML = DAKIKALAR.map((d) => `<option>${d}</option>`).join("");
  }

  (function varsayilanlar() {
    const d = new Date(); d.setDate(d.getDate() + 3);
    $("tarih").value = `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
    const s = new Date();
    const h = (s.getHours() + (s.getMinutes() >= 30 ? 1 : 0)) % 24;
    $("basH").value = iki(h); $("basD").value = "00";
    $("bitH").value = iki((h + 1) % 24); $("bitD").value = "00";
  })();

  HATIRLA.forEach((id) => {
    const v = localStorage.getItem("sk_" + id);
    if (v !== null) $(id).value = v;
    $(id).addEventListener("change", () => localStorage.setItem("sk_" + id, $(id).value));
  });
  if (!$("brans").value) $("brans").value = "KİRALAMA (BASKETBOL - VOLEYBOL)";
  if (!$("satisTuru").value) $("satisTuru").value = "Voleybol";

  // --------------------------------------------------------- 72 saat + özet
  const seansAni = () => {
    const [y, a, g] = ($("tarih").value || "").split("-").map(Number);
    if (!y) return null;
    return new Date(y, a - 1, g, +$("basH").value, +$("basD").value, 0);
  };

  function acilisHesapla() {
    const s = seansAni(); if (!s) return;
    const o = new Date(s); o.setHours(o.getHours() - 72);
    $("acilis").value = `${o.getFullYear()}-${iki(o.getMonth() + 1)}-${iki(o.getDate())}` +
      `T${iki(o.getHours())}:${iki(o.getMinutes())}:00`;
  }

  function ozetYaz() {
    const s = seansAni(), kutu = $("ozet");
    if (!s) { kutu.className = "ozet bad"; kutu.textContent = "Tarih seçilmedi."; return; }
    const o = new Date($("acilis").value || s);
    const f = (d) => `${GUNLER[d.getDay()]} ${iki(d.getDate())}.${iki(d.getMonth() + 1)} ` +
                     `${iki(d.getHours())}:${iki(d.getMinutes())}`;

    // Seanslar seans saatinden tam 72 saat önce siteye düşüyor. Yani:
    //   - seansa 72 saatten ÇOK varsa  -> o ana kadar beklenecek
    //   - 72 saatten AZ varsa          -> seans zaten açılmış, doğrudan aranır
    // İkincisi olağan durum; hata değil, o yüzden kırmızı göstermiyoruz.
    const acilmis = o.getTime() <= Date.now();
    kutu.className = "ozet";
    kutu.textContent = acilmis
      ? `${f(s)} seansı zaten açılmış olmalı (72 saatten yakın). ` +
        `Başlatınca doğrudan aranacak.`
      : `${f(s)} seansı ${f(o)} tarihinde açılacak (72 saat öncesi). ` +
        `O ana kadar beklenip yakalanacak.`;
  }

  ["tarih", "basH", "basD"].forEach((id) => $(id).addEventListener("change", () => {
    if (id !== "tarih") {
      $("bitH").value = iki((+$("basH").value + 1) % 24);
      $("bitD").value = $("basD").value;
    }
    acilisHesapla(); ozetYaz();
  }));
  ["bitH", "bitD", "acilis", "tesis"].forEach((id) =>
    $(id).addEventListener("change", ozetYaz));
  acilisHesapla(); ozetYaz();

  // ------------------------------------------------------------- başlat
  const GEREKLI = [["brans", "Branş"], ["tesis", "Tesis"],
                   ["satisTuru", "Satış türü"], ["tarih", "Tarih"],
                   ["acilis", "Açılış anı"]];

  $("basla").onclick = async () => {
    let ilk = null;
    for (const [id, ad] of GEREKLI) {
      const bos = !$(id).value.trim();
      $(id).classList.toggle("bad", bos);
      if (bos && !ilk) ilk = { id, ad };
    }
    if (ilk) { $(ilk.id).focus(); return; }

    const [y, a, g] = $("tarih").value.split("-");
    const is = {
      aktif: true,
      brans: $("brans").value.trim(),
      tesis: $("tesis").value.trim(),
      salon: $("salon").value.trim() || null,
      satisTuru: $("satisTuru").value.trim(),
      tarih: `${g}.${a}.${y}`,
      saat: `${$("basH").value}:${$("basD").value} - ${$("bitH").value}:${$("bitD").value}`,
      acilis: new Date($("acilis").value).getTime(),
      sepeteEkle: !$("kuruTest").checked,
      pesEtme: 180,
      durum: "bekleme",
      yoklama: 0,
      saatFarki: null,
      kayit: [{ t: new Date().toTimeString().slice(0, 8), m: "Başlatıldı.", tur: "" }],
    };

    await chrome.storage.local.set({ is });

    // spor.istanbul sekmesi açık mı? Varsa onu kullan, yoksa aç.
    const sekmeler = await chrome.tabs.query({ url: "https://online.spor.istanbul/*" });
    if (sekmeler.length) {
      await chrome.tabs.update(sekmeler[0].id, {
        active: true, url: "https://online.spor.istanbul/anasayfa" });
    } else {
      await chrome.tabs.create({ url: "https://online.spor.istanbul/anasayfa" });
    }
    yenile();
  };

  $("durdur").onclick = async () => {
    const { is } = await chrome.storage.local.get("is");
    if (is) { is.aktif = false; is.durum = "durduruldu"; await chrome.storage.local.set({ is }); }
    yenile();
  };

  // -------------------------------------------------------------- durum
  const kacir = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  let acilisMs = null;

  async function yenile() {
    const { is } = await chrome.storage.local.get("is");
    const calisiyor = Boolean(is && is.aktif);

    $("rozet").textContent = is ? (ETIKET[is.durum] || is.durum) : "boşta";
    $("rozet").className = "rozet " + (is ? (TON[is.durum] || "") : "");
    $("basla").disabled = calisiyor;
    $("durdur").disabled = !calisiyor;
    acilisMs = is ? is.acilis : null;

    $("kayit").innerHTML = (is && is.kayit && is.kayit.length)
      ? is.kayit.map((k) => `<span class="t">${k.t}</span>  ` +
          `<span class="${k.tur || ""}">${kacir(k.m)}</span>`).join("\n")
      : '<span class="t">Henüz bir iş başlatılmadı.</span>';
    $("kayit").scrollTop = $("kayit").scrollHeight;
  }

  function tik() {
    if (!acilisMs) { $("geri").textContent = "--:--:--"; return; }
    let f = Math.floor((acilisMs - Date.now()) / 1000);
    const isaret = f < 0 ? "+" : "";
    f = Math.abs(f);
    $("geri").textContent = isaret + iki(Math.floor(f / 3600)) + ":" +
      iki(Math.floor((f % 3600) / 60)) + ":" + iki(f % 60);
  }

  chrome.storage.onChanged.addListener(yenile);
  setInterval(tik, 250);
  yenile(); tik();
})();
