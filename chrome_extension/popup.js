// Pobranie tokena z chrome.storage
chrome.storage.local.get(["githubToken"], async function(result) {
    const TOKEN = result.githubToken;
    if (!TOKEN) {
        alert("Nie ustawiono tokena w Opcjach rozszerzenia!");
        return;
    }

    const REPO = "TWOJE_UZYTKOWNIK/price-tracker"; // zmień na swoje repo
    const FILE_PATH = "data/produkty.json";

    document.getElementById("addProduct").addEventListener("click", async () => {
        // Pobranie aktywnej zakładki
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = tab.url;

        // Tymczasowe ID i pobranie danych z tytułu strony
        const id = Date.now();
        const name = document.title;
        const price = 0; // później można dodać parser strony
        const date = new Date().toISOString();

        try {
            // Pobranie istniejącego pliku JSON z repo
            const getResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
                headers: { Authorization: `token ${TOKEN}` }
            });

            if (!getResponse.ok) {
                alert("Błąd pobierania pliku JSON z repo: " + getResponse.status);
                return;
            }

            const data = await getResponse.json();
            const content = atob(data.content);
            const json = JSON.parse(content);

            // Dodanie nowego produktu
            json.push({ id, url, nazwa: name, cena: price, ostatnia_aktualizacja: date });

            // Zapis z powrotem na GitHub
            const putResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: "Dodano produkt z rozszerzenia",
                    content: btoa(JSON.stringify(json, null, 2)),
                    sha: data.sha
                })
            });

            if (!putResponse.ok) {
                alert("Błąd zapisu pliku na GitHub: " + putResponse.status);
                return;
            }

            alert("✅ Produkt dodany!");
        } catch (err) {
            console.error(err);
            alert("Wystąpił błąd: " + err.message);
        }
    });
});
