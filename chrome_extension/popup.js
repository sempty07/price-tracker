const TOKEN = "TWÓJ_PERSONAL_ACCESS_TOKEN"; // trzeba utworzyć na GitHub
const REPO = "TWOJE_UZYTKOWNIK/price-tracker";
const FILE_PATH = "data/produkty.json";

document.getElementById("addProduct").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const url = tab.url;

  // Poniżej przykład pobrania danych ze strony - dopasuj do konkretnego sklepu
  const id = Date.now(); // tymczasowe ID
  const name = document.title;
  const price = 0; // tu można dodać parser strony
  const date = new Date().toISOString();

  // Pobranie istniejącego pliku JSON z repo
  const getResponse = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: { Authorization: `token ${TOKEN}` }
  });
  const data = await getResponse.json();
  const content = atob(data.content);
  const json = JSON.parse(content);

  // Dodanie nowego produktu
  json.push({ id, url, nazwa: name, cena: price, ostatnia_aktualizacja: date });

  // Zapis z powrotem na GitHub
  await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
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

  alert("Produkt dodany!");
});
