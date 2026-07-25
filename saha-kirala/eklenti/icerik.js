// İÇERİK BETİĞİ — online.spor.istanbul üzerinde çalışır.
//
// Tasarım: durum makinesi, her SAYFA YÜKLEMESİNDE baştan çalışır.
// Site ASP.NET WebForms; her adım tam sayfa postback'i yapıyor, yani bir
// döngü içinde tutunamayız. Bunun yerine işin durumu chrome.storage'da
// duruyor ve betik her yüklendiğinde "şu an neredeyim, sıradaki adım ne"
// diye bakıyor. Postback'ler akışı kesmiyor, aksine akışı ilerletiyor.

(() => {
  "use strict";

  const ANAHTAR = "is";
  const ARAMA_BTN = "pageContent_ucUrunArama_lbtnKiralikAra";
  const SATIS_TURU = "select2-ddlSatisTuru-container";
  const SEPETE_EKLE = "pageContent_lbtnSepeteEkle";
  const SMS_ALANI = "pageContent_txtDogrulamaKodu";

  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------- durum
  const oku = () =>
    new Promise((r) => chrome.storage.local.get(ANAHTAR, (o) => r(o[ANAHTAR] || null)));

  const yaz = (is) =>
    new Promise((r) => chrome.storage.local.set({ [ANAHTAR]: is }, r));

  async function kaydet(mesaj, tur = "") {
    const is = await oku();
    if (!is) return;
    const t = new Date().toTimeString().slice(0, 8);
    is.kayit = (is.kayit || []).concat([{ t, m: mesaj, tur }]).slice(-200);
    await yaz(is);
    console.log("[Saha Kiralama]", t, mesaj);
  }

  async function guncelle(alanlar) {
    const is = await oku();
    if (!is) return null;
    Object.assign(is, alanlar);
    await yaz(is);
    return is;
  }

  async function bitir(durum, mesaj, tur = "") {
    await kaydet(mesaj, tur);
    await guncelle({ aktif: false, durum });
  }

  // -------------------------------------------------------------- yardımcı
  function gorunurYap(el, vurgu = true) {
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - 120;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    if (!vurgu) return;
    const eski = el.style.outline;
    el.style.outline = "3px solid #2b5cf0";
    el.style.outlineOffset = "3px";
    setTimeout(() => { el.style.outline = eski; }, 1500);
  }

  // Sitenin alert()'i sayfa dünyasında yakalanıp buraya bırakılıyor.
  function alertMesaji() {
    const m = document.documentElement.getAttribute("data-saha-kirala-mesaj");
    if (m) document.documentElement.removeAttribute("data-saha-kirala-mesaj");
    return m || null;
  }

  // Select2 sadece bir kabuk; postback'e giden değer alttaki <select>'te.
  // Değeri yazıp `change` olayını tetikliyoruz — sitenin inline onchange'i
  // (ve dolayısıyla __doPostBack) böylece çalışıyor.
  function secimYap(select, istenen) {
    if (!select) return "yok";
    const hedef = [...select.options].find(
      (o) => o.text.trim().toLocaleUpperCase("tr") === istenen.trim().toLocaleUpperCase("tr"));
    if (!hedef) return "secenek-yok";
    if (select.value === hedef.value) return "zaten";
    select.value = hedef.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return "secildi";
  }

  // ------------------------------------------------------- seans bulucu
  function seansButonu(tarih, saat) {
    for (const panel of document.querySelectorAll('div[class*="panel"]')) {
      const h3 = panel.querySelector("h3");
      if (!h3 || !h3.textContent.includes(tarih)) continue;
      for (const kutu of panel.querySelectorAll('div[class*="wellPlus"]')) {
        const etiket = kutu.querySelector('span[class*="lblStyle"]');
        if (!etiket || etiket.textContent.trim() !== saat.trim()) continue;
        return kutu.querySelector('a[id*="lbRezervasyon"]');
      }
    }
    return null;
  }

  const seansSayisi = () =>
    document.querySelectorAll('a[id*="lbRezervasyon"]').length;

  // ------------------------------------------------------------ saat farkı
  // Bilgisayarın saati sunucudan kayabiliyor (ölçümde 16 sn çıkmıştı).
  // Açılış anını sunucu saatine göre beklemek şart.
  async function sunucuFarki() {
    try {
      const y = await fetch(location.origin + "/", { method: "HEAD", cache: "no-store" });
      const d = y.headers.get("Date");
      if (!d) return 0;
      return new Date(d).getTime() - Date.now();
    } catch { return 0; }
  }

  const simdi = (fark) => Date.now() + (fark || 0);

  // ============================================================ ADIMLAR
  async function anasayfaAdimi(is) {
    const brans = document.getElementById("ddlKiralikBransFiltre");
    if (!brans || brans.options.length <= 1) {
      // Liste henüz dolmamış; widget görünmesi hazır olması demek değil.
      await bekle(400);
      return anasayfaAdimi(is);
    }

    const alanlar = [
      ["ddlKiralikBransFiltre", is.brans, "Branş"],
      ["ddlKiralikTesisFiltre", is.tesis, "Tesis"],
    ];
    if (is.salon) alanlar.push(["ddlKiralikSalonFiltre", is.salon, "Salon"]);

    for (const [id, deger, ad] of alanlar) {
      const el = document.getElementById(id);
      const sonuc = secimYap(el, deger);
      if (sonuc === "secildi") {
        await kaydet(`${ad} seçildi: ${deger}`);
        return;                       // postback olacak, betik yeniden çalışır
      }
      if (sonuc === "secenek-yok") {
        return bitir("hata",
          `${ad} listesinde "${deger}" yok. Adı sitedekiyle birebir yazın.`, "hata");
      }
      if (sonuc === "yok") return;    // alan henüz gelmemiş, bir sonraki yüklemede
    }

    const ara = document.getElementById(ARAMA_BTN);
    if (!ara) return;
    await kaydet("Filtreler hazır, aranıyor...");
    ara.click();
  }

  async function yoklamaAdimi(is) {
    const fark = is.saatFarki || 0;
    const kalan = is.acilis - simdi(fark);

    // Açılıştan önceysek bekle. Sayfa açık duruyor, yenilemeye gerek yok.
    if (kalan > 1500) {
      if (!is.beklemeBildirildi) {
        await guncelle({ beklemeBildirildi: true, durum: "bekleme" });
        await kaydet(`Açılışa ${Math.round(kalan / 1000)} sn var, bekleniyor.`);
        const baslik = [...document.querySelectorAll("h4")]
          .find((h) => h.textContent.trim() === "Seans Listesi");
        gorunurYap(baslik, false);
      }
      setTimeout(() => yoklamaAdimi(is), Math.min(kalan - 1000, 5000));
      return;
    }

    const btn = seansButonu(is.tarih, is.saat);
    if (btn) {
      await guncelle({ durum: "yakalandi" });
      await kaydet(`Seans yakalandı (${(is.yoklama || 0) + 1}. yoklama), tıklanıyor.`, "iyi");
      gorunurYap(btn, false);
      btn.click();                    // postback → rezervasyon formu
      return;
    }

    // Süre doldu mu?
    const gecen = simdi(fark) - is.acilis;
    if (gecen > (is.pesEtme || 180) * 1000) {
      return bitir("hata",
        `${is.tarih} ${is.saat} seansı ${Math.round(gecen / 1000)} sn içinde ` +
        `çıkmadı (${is.yoklama || 0} yoklama). Kapılmış ya da hiç açılmamış olabilir.`, "hata");
    }

    const n = (is.yoklama || 0) + 1;
    await guncelle({ yoklama: n, durum: "yoklama" });
    if (n === 1 || n % 10 === 0) {
      await kaydet(`${n}. yoklama — sayfada ${seansSayisi()} seans var, aranan yok.`);
    }

    // Formu yeniden gönder. ÖNEMLİ: /satiskiralik adresine düz GET atmak
    // sunucudaki arama durumunu sıfırlıyor (filtreler "-- Seçiniz --" oluyor,
    // sayfa boşalıyor). __doPostBack ise mevcut değerlerle taze sonuç veriyor.
    const ilkYirmiSaniye = gecen < 20000;
    await bekle(ilkYirmiSaniye ? 300 : 1500);
    formuYenidenGonder();
  }

  function formuYenidenGonder() {
    const form = document.forms[0];
    if (!form) return;
    const hedef = form.querySelector('input[name="__EVENTTARGET"]');
    const arg = form.querySelector('input[name="__EVENTARGUMENT"]');
    if (hedef) hedef.value = "";
    if (arg) arg.value = "";
    form.submit();
  }

  async function formAdimi(is) {
    const mesaj = alertMesaji();
    if (mesaj) await kaydet(`Site mesajı: ${mesaj}`);

    const kap = document.getElementById(SATIS_TURU);
    gorunurYap(kap);

    const select = document.getElementById("ddlSatisTuru");
    const sonuc = secimYap(select, is.satisTuru);
    if (sonuc === "secenek-yok") {
      return bitir("hata",
        `Satış türü listesinde "${is.satisTuru}" yok.`, "hata");
    }
    if (sonuc === "secildi") {
      await guncelle({ durum: "form" });
      await kaydet(`Satış türü seçildi: ${is.satisTuru}`);
      return;                          // postback → Sepete Ekle butonu gelecek
    }

    // Zaten seçili: Sepete Ekle butonu çıkmış olmalı.
    const sepet = document.getElementById(SEPETE_EKLE);
    if (!sepet) { await bekle(500); return formAdimi(is); }

    if (is.sepeteEkle === false) {
      gorunurYap(sepet);
      return bitir("bitti", "Kuru test: Sepete Ekle'ye basılmadı.", "iyi");
    }

    const bant = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 &&
             e.textContent.includes("Sepete ekleme işlemi"));
    if (bant) await kaydet(bant.parentElement.innerText.replace(/\s+/g, " ").trim().slice(0, 90));

    await guncelle({ durum: "sepet" });
    gorunurYap(sepet);
    await bekle(400);
    await kaydet("Sepete ekleniyor...");
    sepet.click();
  }

  async function smsAdimi(is) {
    const mesaj = alertMesaji();
    if (mesaj) await kaydet(`Site mesajı: ${mesaj}`);

    const alan = document.getElementById(SMS_ALANI);
    gorunurYap(alan);
    alan.focus();

    if (is.durum !== "sms") {
      await guncelle({ durum: "sms" });
      await kaydet("Sepete eklendi. Telefonuna gelen kodu bu alana gir.", "iyi");
    }
  }

  // ============================================================ giriş
  async function calis() {
    const is = await oku();
    if (!is || !is.aktif) return;

    const yol = location.pathname.toLowerCase();

    if (yol.includes("uyegiris")) {
      return bitir("hata",
        "Oturumun kapanmış. spor.istanbul'a giriş yapıp yeniden başlat.", "hata");
    }

    // Saat farkını bir kez ölç.
    if (is.saatFarki == null) {
      const f = await sunucuFarki();
      await guncelle({ saatFarki: f });
      is.saatFarki = f;
      if (Math.abs(f) > 3000) {
        await kaydet(`Bilgisayarın saati sunucudan ${Math.abs(f / 1000).toFixed(0)} sn ` +
                     `${f < 0 ? "ileri" : "geri"}. Sunucu saatine göre beklenecek.`);
      }
    }

    if (document.getElementById(SMS_ALANI)) return smsAdimi(is);
    if (document.getElementById(SATIS_TURU)) return formAdimi(is);
    if (yol.includes("satiskiralik")) return yoklamaAdimi(is);
    return anasayfaAdimi(is);
  }

  calis().catch(async (e) => {
    console.error("[Saha Kiralama]", e);
    await bitir("hata", `Beklenmeyen hata: ${e.message}`, "hata");
  });
})();
