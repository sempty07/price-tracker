import json
import requests
import os
from datetime import datetime
from bs4 import BeautifulSoup

DATA_FILE = "data/produkty.json"

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def load_data():
    """Wczytuje listę produktów z pliku JSON."""
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_data(products):
    """Zapisuje zaktualizowaną listę produktów."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

def send_telegram_message(text):
    """Wysyła wiadomość do Telegrama."""
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("⚠️ Brak konfiguracji Telegrama — pomijam wysyłanie wiadomości.")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = {"chat_id": TELEGRAM_CHAT_ID, "text": text}
    try:
        resp = requests.post(url, data=data, timeout=10)
        print(f"📨 Wysyłam do Telegrama: {text}")
        print(f"✅ Odpowiedź Telegrama: {resp.text}")
    except Exception as e:
        print("❌ Błąd wysyłania do Telegrama:", e)

def get_price_from_page(url):
    """Pobiera aktualną cenę z podanego URL."""
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # typowe selektory cen
        selectors = [
            ".price",
            ".product-price__current",
            ".a-price .a-offscreen",
            "[itemprop='price']",
            ".product-prices__price",
            ".price-value",
        ]

        for sel in selectors:
            el = soup.select_one(sel)
            if el:
                price_text = el.get("content") or el.text
                price_text = (
                    price_text.replace(" ", "")
                    .replace("\xa0", "")
                    .replace(",", ".")
                    .replace("zł", "")
                )
                price_text = "".join(ch for ch in price_text if ch.isdigit() or ch == ".")
                try:
                    return float(price_text)
                except ValueError:
                    continue
        return None
    except Exception as e:
        print(f"❌ Błąd pobierania {url}: {e}")
        return None

def check_prices():
    """Sprawdza i aktualizuje ceny produktów."""
    products = load_data()
    print(f"📦 Znaleziono {len(products)} produktów do sprawdzenia.")

    # 🧪 TESTOWA WIADOMOŚĆ DO TELEGRAMA
    send_telegram_message("🧪 Test wiadomości: GitHub Actions działa i bot jest połączony.")
    print("✅ Testowa wiadomość została wysłana do Telegrama.")

    for p in products:
        print(f"🔍 Sprawdzam: {p['name']}")

        new_price = get_price_from_page(p["url"])
        if new_price is None:
            print(f"⚠️ Nie udało się pobrać ceny dla {p['url']}")
            continue

        old_price = float(p["price"])
        p["last_updated"] = datetime.now().isoformat()

        if new_price != old_price:
            msg = (
                f"💰 Zmiana ceny dla {p['name']}!\n"
                f"Stara cena: {old_price:.2f} zł\n"
                f"Nowa cena: {new_price:.2f} zł\n"
                f"🔗 {p['url']}"
            )
            print(msg)
            send_telegram_message(msg)
            p["price"] = new_price
        else:
            print(f"✅ Cena bez zmian ({old_price:.2f} zł)")

    save_data(products)
    print("✅ Zakończono aktualizację.")

if __name__ == "__main__":
    check_prices()
