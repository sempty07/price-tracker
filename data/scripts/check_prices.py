import json
import requests
from datetime import datetime
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "produkty.json"

def load_data():
    if not DATA_FILE.exists():
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def check_prices():
    products = load_data()
    print(f"Sprawdzanie {len(products)} produktów...")

    for p in products:
        # Tu później dodamy pobieranie ceny
        p["ostatnia_aktualizacja"] = datetime.now().isoformat()

    save_data(products)
    print("✅ Zakończono aktualizację.")

if __name__ == "__main__":
    check_prices()
