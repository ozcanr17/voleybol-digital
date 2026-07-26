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
  const ANASAYFA = "https://online.spor.istanbul/anasayfa";

  // Seans, saatinden tam 72 saat önce listeye düşüyor. TAM o saniyede aramak
  // riskli: sunucu isteği sınırın hemen öncesinde işlerse sayfa seans daha
  // eklenmemişken render edilir. Bu yüzden aramayı 1 sn sonraya alıyoruz --- o
  // an seansın listede olduğu garanti.
  const ARAMA_GECIKMESI = 1000;

  // Seans ilk aramada çıkmazsa: sayfayı tazelemek yerine baştan (anasayfa →
  // filtreler → ara) deneniyor. Sayfa tazeleme filtreleri sıfırlıyordu.
  const EN_FAZLA_TUR = 2;

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

  // Metni taşıyan EN İÇTEKİ elemanı bulur (başlığa kaydırmak için).
  //
  // Önceki sürüm yalnızca çocuğu olmayan düğümlere bakıp metni birebir
  // karşılaştırıyordu; başlık `<h4><span>Rezervasyon İşlemi</span></h4>` gibi
  // sarmalanmışsa ya da metinde fazladan boşluk/satır sonu varsa hiç
  // eşleşmiyordu --- kaydırma da bu yüzden çalışmıyordu. Artık boşlukları
  // normalleştirip eşleşenler arasından en az torunu olanı seçiyoruz.
  function metneGoreBul(metin) {
    const duzelt = (s) => (s || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("tr");
    const hedef = duzelt(metin);
    let enIyi = null, enAzTorun = Infinity;
    for (const e of document.querySelectorAll(
           "h1,h2,h3,h4,h5,h6,legend,strong,b,span,div,p,td,label")) {
      if (duzelt(e.textContent) !== hedef) continue;
      const torun = e.getElementsByTagName("*").length;
      if (torun < enAzTorun) { enAzTorun = torun; enIyi = e; }
    }
    return enIyi;
  }

  // Elemanı sayfanın en üstüne getirir (sabit site başlığının hemen altına).
  //
  // `behavior:"smooth"` yarıda kesilebiliyor ve postback sonrası sayfa
  // yerleşimi biz kaydırdıktan sonra oturuyor --- ikisi de kaydırmayı
  // etkisiz bırakıyordu. Anında kaydırıp kısa aralıklarla tekrarlıyoruz.
  function ustuneKaydir(el, tepeBosluk = 100) {
    if (!el) return;
    const uygula = () => {
      const y = el.getBoundingClientRect().top + window.pageYOffset - tepeBosluk;
      window.scrollTo(0, Math.max(0, y));
    };
    uygula();
    setTimeout(uygula, 250);
    setTimeout(uygula, 900);
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
  // Bir <select> seçenekleri dolana kadar bekler. Widget'ın sayfada olması
  // hazır olması demek değil --- boş listeye yazarsak seçim tutmuyor.
  async function seceneklerDolsun(id, sureMs = 8000) {
    const bitis = Date.now() + sureMs;
    while (Date.now() < bitis) {
      const el = document.getElementById(id);
      if (el && el.options.length > 1) return el;
      await bekle(200);
    }
    return null;
  }

  const gorunurMu = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Anasayfa sekmeli: varsayılan olarak "Üyelik Al" açık geliyor ve kiralama
  // filtreleri o sekmede yok. Önce "Kiralama Yap"a geçmek şart --- bu adımı
  // atladığım için otomasyon "Branş listesi dolmadı" diyerek duruyordu.
  async function kiralamaSekmesiniAc() {
    const hazir = () => {
      const kap = document.getElementById("select2-ddlKiralikBransFiltre-container");
      const sec = document.getElementById("ddlKiralikBransFiltre");
      return gorunurMu(kap) && sec && sec.options.length > 1;
    };
    if (hazir()) return true;

    // Sekmeyi asıl açan, onclick="tabYukle('kytabdetay')" taşıyan <a id="kytab">.
    // Onu saran <li>'ye tıklamak HİÇBİR ŞEY yapmıyor (ölçüldü: li -> 0 seçenek,
    // a -> 11 seçenek). Metne göre arama yaparsak querySelectorAll belge sırası
    // döndürdüğü için dıştaki <li> önce geliyor ve yanlış elemanı tıklıyorduk.
    const sekme =
      document.getElementById("kytab") ||
      [...document.querySelectorAll("a.nav-link, span.nav-text")]
        .find((e) => e.textContent.trim() === "Kiralama Yap" && gorunurMu(e));

    if (sekme) {
      sekme.click();
      await kaydet("'Kiralama Yap' sekmesine geçildi.");
    }

    const bitis = Date.now() + 10000;
    while (Date.now() < bitis) {
      if (hazir()) return true;
      await bekle(200);
    }
    return false;
  }

  async function anasayfaAdimi(is) {
    if (!(await kiralamaSekmesiniAc())) {
      return bitir("hata",
        "'Kiralama Yap' sekmesi açılamadı ya da filtreler yüklenmedi. " +
        "spor.istanbul'a giriş yapmış olduğunuzdan emin olup tekrar deneyin.", "hata");
    }

    await guncelle({ durum: "filtre" });

    const alanlar = [
      ["ddlKiralikBransFiltre", is.brans, "Branş"],
      ["ddlKiralikTesisFiltre", is.tesis, "Tesis"],
    ];
    if (is.salon) alanlar.push(["ddlKiralikSalonFiltre", is.salon, "Salon"]);

    for (const [id, deger, ad] of alanlar) {
      const el = await seceneklerDolsun(id);
      if (!el) {
        return bitir("hata",
          `${ad} listesi dolmadı. Sayfayı yenileyip tekrar deneyin.`, "hata");
      }

      const sonuc = secimYap(el, deger);
      if (sonuc === "secenek-yok") {
        return bitir("hata",
          `${ad} listesinde "${deger}" yok. Adı sitedekiyle birebir yazın.`, "hata");
      }
      if (sonuc === "secildi") {
        await kaydet(`${ad} seçildi: ${deger}`);
        // Site bu seçimde postback yapabilir de yapmayabilir de. Yaparsa sayfa
        // yeniden yüklenir ve bu betik zaten baştan çalışır; yapmazsa burada
        // kalıp sıradaki alana geçmeliyiz. Bu yüzden `return` ETMİYORUZ ---
        // sadece bir sonraki listenin tazelenmesi için kısa bir es veriyoruz.
        await bekle(900);
      }
    }

    if (!document.getElementById(ARAMA_BTN)) {
      return bitir("hata", "Arama butonu bulunamadı.", "hata");
    }

    // Açılış anını BURADA, filtreler seçili hâlde bekliyoruz.
    //
    // Sonuç sayfası dinamik değil --- bir anlık görüntü. Oraya erkenden geçip
    // beklemenin faydası yok; üstelik saatlerce beklenirse ASP.NET oturumu ve
    // viewstate bayatlayabilir. Doğru sıra: filtreleri seç, zamanı bekle, tam
    // vaktinde ara. Böylece ilk arama sonucunda seans zaten çıkmış oluyor.
    if (!(await acilisiBekle(is))) return;     // durduruldu

    await kaydet("Açılış anı geçti (+1 sn), aranıyor...");
    const ara = document.getElementById(ARAMA_BTN);
    if (!ara) return bitir("hata", "Arama butonu kayboldu.", "hata");
    tiklaVeyaPostback(ara);
  }

  // Sunucu saatine göre açılış anını bekler. Kullanıcı durdurursa false döner.
  // Hedef, açılış anının kendisi değil 1 sn sonrası (bkz. ARAMA_GECIKMESI).
  async function acilisiBekle(is) {
    const fark = is.saatFarki || 0;
    const hedef = is.acilis + ARAMA_GECIKMESI;
    const kalan0 = hedef - simdi(fark);

    if (kalan0 <= 0) {
      await kaydet("Seans zaten açılmış, doğrudan aranıyor.");
      return true;
    }

    await guncelle({ durum: "bekleme" });
    await kaydet(`Filtreler hazır. Açılışa ${Math.round((kalan0 - ARAMA_GECIKMESI) / 1000)} sn var; ` +
                 `garanti olsun diye açılıştan 1 sn sonra aranacak.`);

    let sonBildirim = 0;
    while (true) {
      const guncel = await oku();
      if (!guncel || !guncel.aktif) return false;

      const kalan = guncel.acilis + ARAMA_GECIKMESI - simdi(fark);
      if (kalan <= 0) return true;

      // Uzun beklemelerde arada haber ver; sessiz kalıp donmuş gibi görünmesin.
      const dk = Math.floor(kalan / 60000);
      if (kalan > 60000 && dk !== sonBildirim && dk % 5 === 0) {
        sonBildirim = dk;
        await kaydet(`Açılışa ${dk} dakika var...`);
      }
      await bekle(Math.min(kalan, 1000));
    }
  }

  async function yoklamaAdimi(is) {
    const fark = is.saatFarki || 0;
    const kalan = is.acilis - simdi(fark);

    // Normalde buraya açılış anı gelmişken varılır --- beklemeyi anasayfada,
    // filtreler seçili hâlde yapıyoruz. Bu dal yalnızca güvenlik ağı: sonuç
    // sayfasına bir şekilde erken düşülürse burada da bekleriz.
    if (kalan > 1500) {
      if (!is.beklemeBildirildi) {
        // NOT: `guncelle` depoyu günceller ama elimizdeki nesneyi değiştirmez;
        // yerelde de işaretlemezsek her turda tekrar günlüğe yazardı.
        is.beklemeBildirildi = true;
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
      await kaydet(`Seans yakalandı (${(is.yoklama || 0) + 1}. deneme), tıklanıyor.`, "iyi");
      gorunurYap(btn, false);
      tiklaVeyaPostback(btn);         // postback → rezervasyon formu
      return;
    }

    // Seans listede yok.
    //
    // Sonuç sayfasını yerinde tazelemek (postback / yeniden gönderim) çözüm
    // değil: sunucu aramayı sıfırlıyor ve filtreler (branş/tesis/salon)
    // kayboluyor, sonraki yoklamalar boş sayfayı tarıyor. Bunun yerine baştan
    // gidiyoruz: anasayfaya dön → formu yeniden doldur → ara. Açılış anı
    // geçtiği için bekleme adımı anında geçilir.
    const tur = (is.yoklama || 0) + 1;
    if (tur > EN_FAZLA_TUR) {
      return bitir("hata",
        `${is.tarih} ${is.saat} seansı ${tur} denemede de listeye düşmedi. ` +
        `Kapılmış ya da bu saatte hiç açılmamış olabilir.`, "hata");
    }

    await guncelle({ yoklama: tur, durum: "yoklama" });
    await kaydet(`Seans listede yok (sayfada ${seansSayisi()} seans). ` +
                 `${tur}/${EN_FAZLA_TUR}: filtreler yeniden girilip aranacak.`);

    await bekle(1000);
    location.href = ANASAYFA;
  }

  // ---------------------------------------------------------- postback
  // Sitedeki butonlar <a href="javascript:__doPostBack(...)"> biçiminde.
  // Content script'ler izole dünyada çalışır ve Chrome, izole dünyadan
  // başlatılan `javascript:` URL'lerini ÇALIŞTIRMAZ (aksi halde eklentiler
  // sayfaya keyfi kod enjekte edebilirdi). Sonuç: element.click() sadece
  // onclick özniteliğini tetikliyor --- arama butonunda bu "butonu kilitle ve
  // dönen simgeyi göster" demek --- ama postback hiç olmuyor ve sayfa sonsuza
  // kadar dönüyordu.
  //
  // Çözüm: href'e hiç güvenmeyip postback'i kendimiz yapıyoruz. Hedefi href'ten
  // okuyup ASP.NET'in gizli alanlarına yazıyor ve formu gönderiyoruz.
  function postbackHedefi(el) {
    const h = (el && el.getAttribute("href")) || "";
    let m = h.match(/WebForm_PostBackOptions\(\s*["']([^"']+)["']/);
    if (m) return { hedef: m[1], arg: "" };
    m = h.match(/__doPostBack\(\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']/);
    if (m) return { hedef: m[1], arg: m[2] };
    return null;
  }

  function postbackYap(el) {
    const p = postbackHedefi(el);
    const form = document.forms[0];
    if (!p || !form) return false;
    const hedef = form.querySelector('input[name="__EVENTTARGET"]');
    const arg = form.querySelector('input[name="__EVENTARGUMENT"]');
    if (!hedef || !arg) return false;
    hedef.value = p.hedef;
    arg.value = p.arg;
    form.submit();
    return true;
  }

  // Önce gerçek postback'i dene, olmazsa tıklamaya düş (onclick'le çalışan
  // düğmeler için --- örneğin sekmeler).
  function tiklaVeyaPostback(el) {
    if (postbackYap(el)) return "postback";
    el.click();
    return "tiklama";
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

    // Zaten seçili: Sepete Ekle butonu çıkmış olmalı. Buton satış türü
    // seçilmeden sayfada hiç bulunmuyor, o yüzden çıkmasını bekliyoruz.
    let sepet = null;
    const sabir = Date.now() + 15000;
    while (Date.now() < sabir) {
      sepet = document.getElementById(SEPETE_EKLE);
      if (sepet) break;
      await bekle(300);
    }
    if (!sepet) {
      return bitir("hata",
        `"${is.satisTuru}" seçili ama Sepete Ekle butonu çıkmadı. ` +
        `Bu seans için bu satış türü geçerli olmayabilir.`, "hata");
    }

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
    tiklaVeyaPostback(sepet);
  }

  async function smsAdimi(is) {
    const mesaj = alertMesaji();
    if (mesaj) await kaydet(`Site mesajı: ${mesaj}`);

    const alan = document.getElementById(SMS_ALANI);

    // Kod alanına değil, "Rezervasyon İşlemi" başlığına kaydırıyoruz: kullanıcı
    // kodu girmeden önce hangi seansı ve ücreti onayladığını görmeli. Başlık
    // sayfanın en üstüne (sabit site başlığının hemen altına) geliyor.
    ustuneKaydir(metneGoreBul("Rezervasyon İşlemi") || alan);

    // focus() varsayılan olarak elemanı görünür alana kaydırır ve az önce
    // ayarladığımız konumu bozardı.
    alan.focus({ preventScroll: true });

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

    // Kod doğrulanınca site sepet sayfasına geçiriyor. Oraya düştüysek iş
    // BİTMİŞTİR. Bu kontrol olmadan sepet sayfası tanınmıyor, akış en alttaki
    // anasayfa adımına düşüyor ve "'Kiralama Yap' sekmesi açılamadı" diye
    // gerçekte var olmayan bir hata yazılıyordu --- seans aslında sepetteydi.
    if (yol.includes("uyesepet")) {
      if (is.durum === "sms" || is.durum === "sepet") {
        return bitir("bitti",
          "Sepet sayfası açıldı: seans sepete eklendi. Ödemeyi sitede tamamlayın.", "iyi");
      }
      return;   // başka bir sebeple sepetteyiz; karışma
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
