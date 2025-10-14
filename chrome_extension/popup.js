async function getProductInfo() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Wykonaj skrypt na stronie produktu, aby pobrać dane
    const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            // Spróbuj pobrać nazwę produktu
            let name = document.querySelector(".product-title")?.innerText
                || document.querySelector("h1")?.innerText
                || document.title;

            // Spróbuj pobrać cenę produktu
            let priceText = document.querySelector(".price")?.innerText
                || document.querySelector(".product-price")?.innerText
                || document.querySelector(".a-price-whole")?.innerText // Amazon
                || "0";

            // Zamień na liczbę (usuń zł, spacje itp.)
            let price = parseFloat(priceText.replace(",", ".").replace(/[^0-9.]/g, "")) || 0;

            return { name, price };
        }
    });

    return result[0].result;
}

document.getElementById("addProduct").addEventListener("click", async () => {
    const { name, price } = await getProductInfo();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab.url;
    const id = Date.now();
    const date = new Date().toISOString();

    // Pobranie tokena GitHub z lokalnego storage
    chrome.storage.local.get(["githubToken"], async function (result) {
        const TOKEN = result.githubToken;
        if (!TOKEN) {
            alert("❌ Nie ustawiono tokena w Opcjach rozszerzenia!");
            return;
        }

        // 🔧 ZMIEŃ TUTAJ na swoje repozytorium GitHub
        const REPO = "sempty07/price-tracker"; 
        const FILE_PATH = "data/produkty.json";

        try {
            // Pobierz istniejący plik JSON z repo
            let json = [];
            let sha = null;

            const getResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
                headers: { Authorization: `token ${TOKEN}` }
            });

            if (getResponse.ok) {
                const data = await getResponse.json();
                json = JSON.parse(atob(data.content));
                sha = data.sha;
            } else if (getResponse.status === 404) {
                json = [];
            } else {
                alert("❌ Błąd pobierania pliku JSON: " + getResponse.status);
                return;
            }

            // Dodaj nowy produkt
            json.push({
                id,
                url,
                nazwa: name,
                cena: price,
                ostatnia_aktualizacja: date
            });

            // Przygotuj treść do wysłania na GitHub
            const body = {
                message: "Dodano produkt z rozszerzenia",
                content: btoa(JSON.stringify(json, null, 2))
            };
            if (sha) body.sha = sha;

            // Zapisz zaktualizowany plik
            const putResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!putResponse.ok) {
                alert("❌ Błąd zapisu pliku na GitHub: " + putResponse.status);
                return;
            }

            alert(`✅ Produkt dodany!\n${name}\nCena: ${price} zł`);
        } catch (err) {
            console.error(err);
            alert("❌ Wystąpił błąd: " + err.message);
        }
    });
});
