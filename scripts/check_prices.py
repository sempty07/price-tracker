# scripts/check_prices.py
import json
import requests
import os
from datetime import datetime
from bs4 import BeautifulSoup

DATA_FILE = "data/produkty.json"

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

def load_data():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_data(products):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

def send_telegram_message(text):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        print("⚠️ Brak konfiguracji Telegrama — pomijam wysyłanie wiadomości.")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    data = {"chat_id": TELEGRAM_CHAT_ID, "text": text}
    try:
        resp = requests.post(url, data=data, timeout=15)
        print("📨 Wysyłam do Telegrama:", text)
        print("📬 Odpowiedź Telegrama:", resp.status_code, resp.text)
    except Exception as e:
        print("❌ Błąd wysyłania do Telegrama:", e)

def normalize_price_value(raw):
    """
    Konwertuje surowy tekst lub liczbę do float lub None.
    Akceptuje:  "1 799,00", "1799", 1799, "1799.00", "1\xa0799,00 zł"
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if text == "":
        return None
    # usuń waluty i spacje no-break
    text = text.replace(" ", "").replace("\xa0", "").replace("zł", "").replace("PLN", "")
    text = text.replace(",", ".")
    # zachowaj tylko cyfry i kropkę
    cleaned = "".join(ch for ch in text if ch.isdigit() or ch == ".")
    if cleaned == "":
        return None
    # jeśli jest więcej niż jedna kropka, usuń wszystko poza pierwszą
    if cleaned.count(".") > 1:
        parts = cleaned.split(".")
        cleaned = parts[0] + "." + "".join(parts[1:])
    try:
        return float(cleaned)
    except Exception as e:
        print("❌ Nie udało się sparsować ceny:", raw, "=>", cleaned, "err:", e)
        return None

def get_price_from_page(url, selector=None):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) "
                      "Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        r = requests.get(url, headers=headers, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # jeśli produkt ma zapisany selector w JSON -> spróbuj go najpierw
        if selector:
            el = soup.select_one(selector)
            if el:
                raw = el.get("content") or el.get_text()
                price = normalize_price_value(raw)
                if price is not None:
                    return price

        # lista fallbackowych selektorów
        selectors = [
            ".product-price__current",
            ".product-prices__price",
            ".price",
            ".a-price .a-offscreen",
            "[itemprop='price']",
            ".price-value",
            ".price__regular",
            ".price--current"
        ]
        for sel in selectors:
            el = soup.select_one(sel)
            if el:
                raw = el.get("content") or el.get_text()
                price = normalize_price_value(raw)
                if price is not None:
                    return price

        # nie znaleziono ceny
        return None
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP error dla {url}: {e}")
        return None
    except Exception as e:
        print(f"❌ Błąd pobierania {url}: {e}")
        return None

def check_prices():
    products = load_data()
    print(f"📦 Znaleziono {len(products)} produktów do sprawdzenia.")

    for p in products:
        name = p.get("name") or p.get("url")
        print(f"🔍 Sprawdzam: {name}")

        selector = p.get("selector")
        new_price = get_price_from_page(p.get("url"), selector)

        # DEBUG: pokaż wartości
        print("   selector:", selector)
        print("   cena pobrana (raw):", new_price)

        # normalizuj starą cenę (może być string)
        old_price = normalize_price_value(p.get("price"))
        print("   cena zapisana (old):", p.get("price"), "=>", old_price)

        if new_price is None:
            print(f"⚠️ Nie udało się pobrać ceny dla {p.get('url')}")
            # nie rób nic dalej dla tego produktu
            continue

        # porównanie z tolerancją dla float (np. drobne zaokrąglenia)
        if old_price is None:
            changed = True
        else:
            changed = abs(new_price - old_price) > 0.001

        # Aktualizuj pole last_updated zawsze jeśli pobrano cenę
        p["last_updated"] = datetime.utcnow().isoformat()

        if changed:
            direction = "▲" if new_price > (old_price or 0) else "▼"
            msg = (
                f"{direction} Zmiana ceny: {p.get('name')}\n"
                f"Stara: {old_price if old_price is not None else '—'} zł\n"
                f"Nowa: {new_price:.2f} zł\n"
                f"{p.get('url')}"
            )
            print("   !!! ZMIANA:", msg.replace("\n", " | "))
            send_telegram_message(msg)
            # zapisz nową cenę (jako float lub string zachowamy float)
            p["price"] = new_price
        else:
            print(f"   ✅ Cena bez zmian ({old_price:.2f} zł)")

    # zapisujemy zawsze (zaktualizowane last_updated / price)
    save_data(products)
    print("✅ Zakończono aktualizację.")

if __name__ == "__main__":
    check_prices()
