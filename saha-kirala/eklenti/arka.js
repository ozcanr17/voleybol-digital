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

// İşi durdurup gerekçesini kayda düşer. Zaten duran bir işe dokunmaz.
async function durdur(mesaj, tur = "") {
  const { is } = await chrome.storage.local.get("is");
  if (!is || !is.aktif) return false;
  is.aktif = false;
  is.durum = "durduruldu";
  is.kayit = (is.kayit || []).concat([{
    t: new Date().toTimeString().slice(0, 8), m: mesaj, tur,
  }]);
  await chrome.storage.local.set({ is });
  return true;
}

// Otomasyonun yürüdüğü sekme kapatılırsa iş sürdürülemez --- açıkta kalmış
// gibi görünüp sessizce ölmesindense durumu net biçimde bildiriyoruz.
chrome.tabs.onRemoved.addListener((sekmeId) => {
  (async () => {
    const { is } = await chrome.storage.local.get("is");
    if (!is || !is.aktif || is.sekmeId !== sekmeId) return;
    await durdur("Kullanıcı sekmeyi kapattı, otomasyon durduruldu.", "hata");
  })();
});

chrome.runtime.onMessage.addListener((mesaj, gonderen, cevapla) => {
  (async () => {
    try {
      switch (mesaj && mesaj.komut) {
        case "baslat": {
          // Sıra önemli: sekmeyi açmadan ÖNCE işi yazıyoruz, yoksa sekmede
          // hemen çalışan içerik betiği depoyu boş bulup hiçbir şey yapmaz.
          await chrome.storage.local.set({ is: mesaj.is });
          const sekmeId = await sporSekmesiniAc();
          // Sekme kimliğini sonradan ekliyoruz; sekme kapanırsa otomasyonu
          // durdurabilmek için gerekli (chrome.tabs.onRemoved).
          const { is } = await chrome.storage.local.get("is");
          if (is) { is.sekmeId = sekmeId; await chrome.storage.local.set({ is }); }
          cevapla({ ok: true, sekmeId });
          break;
        }
        case "durdur": {
          await durdur("Kullanıcı durdurdu.");
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
