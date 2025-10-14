import json
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "produkty.json"
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

# jeśli plik nie istnieje lub jest pusty, utwórz pustą listę
if not DATA_FILE.exists() or DATA_FILE.stat().st_size == 0:
    DATA_FILE.write_text("[]", encoding="utf-8")

def load_data():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def check_prices():
    products = load_data()
    print(f"Sprawdzanie {len(products)} produktów...")

    for p in products:
        p["ostatnia_aktualizacja"] = "2025-10-14T12:00:00"  # przykładowa wartość

    save_data(products)
    print("✅ Zakończono aktualizację.")

if __name__ == "__main__":
    check_prices()
