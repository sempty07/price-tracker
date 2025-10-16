import json
import requests
import os
import random
from datetime import datetime
from bs4 import BeautifulSoup

DATA_FILE = "data/produkty.json"

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# Rotacja User-Agentów (zmniejsza ryzyko 403)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]


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
        if resp.status_code == 200:
            print("📨 Wiadomość wysłana do Telegrama.")
        else:
            print(f"⚠️ Błąd wysyłania do Telegrama: {resp.text}")
    except Exception as e:
        print("❌ Błąd sieci przy wysyłaniu do Telegrama:", e)


def get_price_from_page(url):
    """Pobiera aktualną cenę z podanego URL."""
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Referer": "https://www.google.com/",
        "Connection": "keep-alive",
    }

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
            "#price",
            ".cena",
            "meta[itemprop='price']",
            "#zakup-zwykly > div > span:nth-child(3)",  # ← ten działał dla Zapato
            ".product-info .price",                      # dodatkowy ogólny
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

        # debug: podgląd fragmentu strony, jeśli nie znaleziono ceny
        print(f"⚠️ Nie znaleziono ceny dla {url}, fragment HTML:")
        print(r.text[:500])
        return None

    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP error dla {url}: {e}")
        return None
    except Exception as e:
        print(f"❌ Błąd pobierania {url}: {e}")
        return None



def check_prices():
    """Sprawdza i aktualizuje ceny produktów."""
    products = load_data()
    print(f"📦 Znaleziono {len(products)} produktów do sprawdzenia.\n")

    for p in products:
        print(f"🔍 Sprawdzam: {p['name']}")

        new_price = get_price_from_page(p["url"])
        old_price = float(p["price"])
        p["last_updated"] = datetime.now().isoformat()

        if new_price is None:
            print(f"⚠️ Nie udało się pobrać ceny dla {p['url']}\n")
            continue

        if new_price != old_price:
            msg = (
                f"💰 Zmiana ceny: {p['name']}\n"
                f"Stara cena: {old_price:.2f} zł\n"
                f"Nowa cena: {new_price:.2f} zł\n"
                f"🔗 {p['url']}"
            )
            print(msg)
            send_telegram_message(msg)
            p["price"] = new_price
        else:
            print(f"✅ Cena bez zmian ({old_price:.2f} zł)\n")

    save_data(products)
    print("✅ Zakończono aktualizację.\n")


if __name__ == "__main__":
    check_prices()
