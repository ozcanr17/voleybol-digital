// ARKA PLAN (service worker).
//
// Tek işi: siteden gelen komutları alıp chrome.tabs ile sekmeyi açmak/odaklamak
// ve işi depoya yazmak. İçerik betikleri chrome.tabs API'sine erişemez, bu
// yüzden bu katman şart.
//
// Otomasyonun kendisi burada değil --- o, spor.istanbul sekmesindeki
// icerik.js'te çalışıyor.

const ANASAYFA = "https://online.spor.istanbul/anasayfa";

async function sporSekmesiniAc() {
  const sekmeler = await chrome.tabs.query({ url: "https://online.spor.istanbul/*" });
  if (sekmeler.length) {
    await chrome.tabs.update(sekmeler[0].id, { active: true, url: ANASAYFA });
    await chrome.windows.update(sekmeler[0].windowId, { focused: true });
    return sekmeler[0].id;
  }
  const yeni = await chrome.tabs.create({ url: ANASAYFA, active: true });
  return yeni.id;
}

chrome.runtime.onMessage.addListener((mesaj, gonderen, cevapla) => {
  (async () => {
    try {
      switch (mesaj && mesaj.komut) {
        case "baslat": {
          await chrome.storage.local.set({ is: mesaj.is });
          const sekmeId = await sporSekmesiniAc();
          cevapla({ ok: true, sekmeId });
          break;
        }
        case "durdur": {
          const { is } = await chrome.storage.local.get("is");
          if (is) {
            is.aktif = false;
            is.durum = "durduruldu";
            is.kayit = (is.kayit || []).concat([{
              t: new Date().toTimeString().slice(0, 8),
              m: "Kullanıcı durdurdu.", tur: "",
            }]);
            await chrome.storage.local.set({ is });
          }
          cevapla({ ok: true });
          break;
        }
        case "temizle": {
          const { is } = await chrome.storage.local.get("is");
          if (is) { is.kayit = []; await chrome.storage.local.set({ is }); }
          cevapla({ ok: true });
          break;
        }
        case "durum": {
          const { is } = await chrome.storage.local.get("is");
          cevapla({ ok: true, is: is || null });
          break;
        }
        default:
          cevapla({ ok: false, hata: "bilinmeyen komut" });
      }
    } catch (e) {
      cevapla({ ok: false, hata: String(e) });
    }
  })();
  return true;         // eşzamansız cevap vereceğiz
});
