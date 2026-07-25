# Devir Notu — voleybol.digital / Saha Kiralama (GERÇEK proje)

Bağlamsız yeni bir Claude oturumu için yazıldı. Sıfırdan biliyormuş gibi oku.

## EN ÖNEMLİ UYARI — doğru klasörde çalış

Bu bilgisayarda iki klasör var ve önceki iki oturum **yanlış olanında** çalıştı:

- ❌ `C:\Users\Elessar\PycharmProjects\voleybol` — ESKİ FastAPI/Selenium
  uygulaması. **Artık kullanılan canlı ürün DEĞİL.** Sadece
  `saha-kirala/indir/saha-kiralama.zip` olarak indirilebilir paket. Buradaki
  `app/static/index.html`'e yapılan combobox/tarih düzeltmeleri **kullanıcıya
  hiç ulaşmadı** çünkü yayınlanan ürün burası değil. (O klasörde yanlışlıkla
  bir `git init` yapıldı; remote'u yok, zararsız ama oraya push ETME.)
- ✅ `C:\Users\Elessar\PycharmProjects\voleybol-digital` — **GERÇEK proje.**
  GitHub: https://github.com/ozcanr17/voleybol-digital (public, `main`).
  Canlı: **https://voleybol.digital** (CNAME → GitHub Pages).
  **Tüm arayüz işi burada yapılmalı.**

## Mimari — üç katman

1. **Web arayüzü** — `saha-kirala/index.html` (canlı:
   `https://voleybol.digital/saha-kirala/`). Kullanıcının doldurduğu form burada:
   Branş / Tesis / Salon / Satış türü / Tarih / Saat / Açılış anı. **Combobox
   bug'ı, tarih-saat seçici, canlı listeler = HEP BU DOSYA.** Push edilince
   GitHub Pages **anında** yayınlar; kullanıcının tek yapması gereken sayfayı
   sert yenilemek (Ctrl+Shift+R, cache yüzünden).
2. **Tarayıcı eklentisi** — `saha-kirala/eklenti/` (Manifest V3,
   "Saha Kiralama Otomasyonu" v1.2.0). Kimlik bilgisi İSTEMEZ; kullanıcının
   `online.spor.istanbul`'daki **açık oturumunu** kullanır.
   - `popup.html` / `popup.js`: sadece **durum penceresi** (motor çalışıyor mu,
     log). Form burada DEĞİL — "Arayüzü aç" butonu web arayüzüne götürür.
   - `sayfa.js` (MAIN world, document_start) + `icerik.js` (document_end):
     spor.istanbul sayfasında asıl otomasyonu yapan içerik scriptleri.
   - `site.js`: voleybol.digital / ozcanr17.github.io sayfalarına enjekte olur,
     web arayüzü ile eklenti motorunu köprüler.
   - `arka.js`: service worker / koordinatör.
   - **ÖNEMLİ**: Eklenti dosyalarını değiştirmek repo'ya push ile canlıya
     GEÇMEZ. Eklenti kullanıcının tarayıcısına kurulu; güncellemek için kullanıcı
     eklentiyi yeniden yüklemeli VE `saha-kirala/indir/saha-kirala-eklenti.zip`
     yeniden paketlenmeli. Yani web arayüzü işi (Pages) ile eklenti işi ayrı
     yayın yollarına sahip.
3. **İniş sayfası** — kök `index.html` + `mikasa.png` (voleybol topu görseli) +
   `CNAME` (voleybol.digital) + `saha-kirala/indir/` (kur.bat, kur.command,
   zip'ler).

## Genel hedef (kullanıcının istediği işler)

1. **Bug**: `saha-kirala/index.html`'de Branş/Tesis/Salon/Satış türü alanları
   native `<input list="datalist">` (satır ~219-261). Seçim yapıldıktan sonra
   tekrar tıklayınca liste açılmıyor (Chrome/Edge datalist davranışı) →
   kullanıcı "kilitlendi, değiştiremiyorum" sanıyor; yazıyı silince diğerleri
   geliyor. **Çözüm: native datalist'i kaldırıp kendi `makeCombo()` bileşenini
   kullan** (her focus/click'te tam listeyi açar).
   - Hazır, çalışan bir referans uygulaması ESKİ klasörde var:
     `voleybol/app/static/index.html` (~satır 436 `makeCombo`). Mantık aynen
     uyarlanabilir. **DİKKAT — id'ler farklı**: burada `brans`, `tesis`,
     `salon`, **`satisTuru`** (alt çizgisiz), `tarih`, `acilis`, `kuruTest`.
     Eski dosyada `satis_turu`, `date`, `open_at`, `stop_before_cart` idi.
     Kopyala-yapıştır etme, id'leri bu dosyaya göre eşle.
2. **Canlı listeler** (ertelendi): Branş → tesis → salon → satış türü listeleri
   sitedeki gerçek verilerden gelsin. Kararlaştırılan yaklaşım: canlı backend
   keşfi YERİNE `index.html`'e gömülü **statik ama zincirli harita**. Veriyi
   kullanıcı bir kez konsol snippet'iyle çekip verecek (snippet aşağıda). Site
   select id'leri: `ddlKiralikBransFiltre`, `ddlKiralikTesisFiltre`,
   `ddlKiralikSalonFiltre`, `ddlSatisTuru`.
3. **Tarih/saat seçici**: Kullanıcı klasik takvim + saat sütunlu bir "Date Time
   Picker" ekran görüntüsü gönderdi ("attığım gibi yapabilirsin") — solda
   ay/gün takvimi, sağda kaydırılabilir saat sütunu (00:00, 01:00, …). **Öneri
   (henüz onaylanmadı)**: mevcut `<input id="tarih" type="date">` + saat
   alanlarının yerine tek bir takvim-popup picker; vanilla JS, mevcut temaya
   (CSS değişkenleri, dark/light) uygun. Arka plan mantığını koru: `acilis`
   (72 saat öncesi) hesabı, bitiş = başlangıç +1 saat, özet.
4. **Logo/ikon**: Kullanıcı "eklentinin logosu için spor.istanbul logosunu
   kullanabilirsin" dedi. **`manifest.json`'da hiç `icons` / `default_icon`
   yok** → eklenti varsayılan bulmaca ikonuyla görünüyor. İş = ikon PNG'leri
   ekle + manifest'e `icons` ve `action.default_icon` ekle + zip'i yeniden
   paketle. spor.istanbul logosunu kullanıcıdan iste ya da izinle siteden çek;
   **onaysız harici indirme yapma.** (Sitede zaten `mikasa.png` var, alternatif.)

## ŞU ANKİ DURUM — bu oturumda ne yapıldı

- Yanlış-klasör kök nedeni **teşhis edildi ve doğrulandı** (yukarıdaki tablo).
- `voleybol-digital` repo'su bu bilgisayara **klonlandı**
  (`C:\Users\Elessar\PycharmProjects\voleybol-digital`).
- Bu HANDOFF.md yazıldı ve `voleybol-digital` main'e push edildi.
- **Hiç kod düzeltmesi YAPILMADI.** Combobox hâlâ datalist, tarih/saat eski,
  ikon yok. Sıradaki oturum asıl işi burada, doğru dosyada yapmalı.

## KULLANICIDAN BEKLEYEN / SONRAKİ ADIMLAR

1. **Combobox (bug #1)** — `saha-kirala/index.html`'de datalist → `makeCombo`.
   En net, riski düşük iş. Yaparken gerçek tarayıcıda doğrula (aşağıki test).
2. **Tarih/saat picker** — kullanıcı onayı al (yerine mi geçsin / nasıl), sonra
   uygula.
3. **İkon/logo** — kullanıcıdan spor.istanbul logo dosyasını iste; manifest +
   zip'i güncelle; kullanıcı eklentiyi yeniden yüklesin.
4. **Canlı listeler** — kullanıcının konsol snippet çıktısını bekle, zincirli
   haritayı kur, `combos.tesis.setOptions(...)` deseniyle bağla.

Konsol snippet'i (kullanıcı giriş yapıp Kiralama Yap sayfasında çalıştıracak;
ASP.NET postback yüzünden zincir için birkaç yakalama gerekir):
```js
(() => {
  const ids = ["ddlKiralikBransFiltre","ddlKiralikTesisFiltre","ddlKiralikSalonFiltre","ddlSatisTuru"];
  const out = {};
  for (const id of ids) {
    const sel = document.getElementById(id); if (!sel) continue;
    out[id] = { secili: (sel.options[sel.selectedIndex]?.text||"").trim()||null,
      secenekler: [...sel.options].map(o=>o.text.trim()).filter(t=>t&&t!=="-- Seçiniz --") };
  }
  const s = JSON.stringify(out,null,2); console.log(s); return s;
})();
```

## NASIL TEST EDİLİR (arayüz değişikliği)

Web arayüzü statik HTML/JS; yerelde açıp test edilebilir. Örn. klasörde
basit bir sunucu: `saha-kirala/` içinde bir statik dosya sunucusu çalıştır ve
Browser pane ile aç. Doğrulama araçları: `read_page` (accessibility ağacı —
güvenilir), `read_console_messages`. NOT: bu ortamda
`computer{action:"screenshot"}` 30 sn timeout verebildi; `read_page`'e güven.
`tabId` parametresi zorunlu. Kullanıcı ayrıca canlıda kendi test ediyor —
push sonrası Ctrl+Shift+R ile sert yenilemesini söyle (cache).

## DÜŞÜLMEMESİ GEREKEN TUZAKLAR

- **EN BÜYÜĞÜ: yanlış klasör.** Arayüz işini `voleybol-digital/saha-kirala/
  index.html`'de yap. `voleybol/` (FastAPI) ölü. Değişikliğin kullanıcının
  gördüğü yere (voleybol.digital) gerçekten ulaştığından emin ol — geçen iki
  oturumun tek büyük hatası buydu.
- **Web arayüzü ≠ eklenti yayın yolu.** `saha-kirala/index.html` push → Pages
  anında. Eklenti dosyaları push → kullanıcı yeniden yüklemeden değişmez + zip
  paketlenmeli. Karıştırma.
- **`<input list="...">` (native datalist) kullanma** — bug'ın ta kendisi.
  `makeCombo` kullan.
- **"Sözdizimi parse oldu" ≠ "çalışıyor."** Görsel/davranışsal her değişikliği
  gerçek tarayıcıda doğrula.
- **Kimlik (T.C./şifre) diske/loga yazma.** Eklenti zaten kimlik istemiyor
  (açık oturumu kullanıyor) — bu tasarımı bozma.
- **İş 2 mimarisine kullanıcı onayı almadan girme / kod yazma.**
- Repo public — buraya gizli/hassas bilgi yazma (bu handoff'ta sır yok).
