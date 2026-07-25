#!/bin/bash
# Saha Kiralama Otomasyonu — macOS kurulum sihirbazı
#
# İndirdikten sonra Finder'da çift tıklayın. "Geliştirici doğrulanamadı"
# uyarısı çıkarsa: sağ tık > Aç > Aç.
# Terminal "izin reddedildi" derse: chmod +x kur.command

set -u

KAYNAK="https://voleybol.digital/saha-kirala/indir/saha-kiralama.zip"
HEDEF="$HOME/Applications/SahaKiralama"

dur() { echo; echo "  Kapatmak için Enter..."; read -r _; exit "${1:-1}"; }

echo
echo "  ============================================"
echo "    Saha Kiralama Otomasyonu — Kurulum"
echo "  ============================================"
echo
echo "  Kurulacağı yer: $HEDEF"
echo

# ========================================================= 1/5  Python
echo "  [1/5] Python kontrol ediliyor..."
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$c" >/dev/null 2>&1 &&
       "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
        PY="$c"; break
    fi
done

if [ -z "$PY" ]; then
    echo "        Python 3.10+ bulunamadı."
    if command -v brew >/dev/null 2>&1; then
        echo "        Homebrew ile kuruluyor..."
        brew install python@3.12 || { echo "  [HATA] Kurulamadı."; dur 1; }
        PY="$(brew --prefix)/bin/python3.12"
    else
        echo
        echo "  [DUR] Python kurulu değil ve Homebrew da yok."
        echo "        Şu adresten kurun: https://www.python.org/downloads/macos/"
        echo "        Kurduktan sonra bu dosyayı tekrar çalıştırın."
        dur 1
    fi
fi
echo "        Tamam ($("$PY" -c 'import sys;print(sys.version.split()[0])'))"

# ========================================================= 2/5  Chrome
echo "  [2/5] Google Chrome kontrol ediliyor..."
if [ -d "/Applications/Google Chrome.app" ]; then
    echo "        Tamam."
else
    echo "        Bulunamadı."
    if command -v brew >/dev/null 2>&1; then
        echo "        Homebrew ile kuruluyor..."
        brew install --cask google-chrome || echo "        [UYARI] Kurulamadı."
    else
        echo "        [UYARI] Elle kurun: https://www.google.com/chrome/"
    fi
fi

# ========================================================= 3/5  İndirme
echo "  [3/5] Uygulama indiriliyor..."
TMP="$(mktemp -d)"
if ! curl -fsSL "$KAYNAK" -o "$TMP/saha-kiralama.zip"; then
    echo "  [HATA] İndirme başarısız. İnternet bağlantınızı kontrol edin."
    rm -rf "$TMP"; dur 1
fi
if ! unzip -q "$TMP/saha-kiralama.zip" -d "$TMP"; then
    echo "  [HATA] Arşiv açılamadı."
    rm -rf "$TMP"; dur 1
fi
rm -rf "$HEDEF"
mkdir -p "$(dirname "$HEDEF")"
mv "$TMP/saha-kiralama" "$HEDEF"
rm -rf "$TMP"
chmod +x "$HEDEF/baslat.command" 2>/dev/null
echo "        Tamam."

# ========================================================= 4/5  Paketler
echo "  [4/5] Gerekli paketler kuruluyor (birkaç dakika sürebilir)..."
cd "$HEDEF" || dur 1
"$PY" -m venv .venv || { echo "  [HATA] Python ortamı oluşturulamadı."; dur 1; }
.venv/bin/python -m pip install --quiet --upgrade pip
if ! .venv/bin/python -m pip install --quiet -r requirements.txt; then
    echo "  [HATA] Paketler kurulamadı."
    dur 1
fi
echo "        Tamam."

# ========================================================= 5/5  Kısayol
echo "  [5/5] Kısayol oluşturuluyor..."
# macOS'ta .command dosyası çift tıklanabilir; masaüstüne bağ koyuyoruz.
ln -sf "$HEDEF/baslat.command" "$HOME/Desktop/Saha Kiralama.command" 2>/dev/null
echo "        Tamam."

echo
echo "  ============================================"
echo "    Kurulum tamamlandı."
echo "  ============================================"
echo
echo "  Bundan sonra masaüstündeki \"Saha Kiralama\" dosyasına"
echo "  çift tıklamanız yeterli."
echo
echo "  Şimdi başlatılıyor..."
echo
open "$HEDEF/baslat.command" 2>/dev/null || "$HEDEF/baslat.command" &
sleep 3
