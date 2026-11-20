# Concierge MVP — powered by Project Concierge

Citofono digitale per edifici: il visitatore inquadra il QR, chiama una persona o usa un PIN temporaneo; chi abita o lavora nell'edificio risponde dal proprio link personale.

## Pagine (GitHub Pages)

| Pagina | Per chi |
|---|---|
| `index.html` | Visitatore: si apre dal QR sul portone |
| `condomino.html?t=TOKEN` | Persona dell'edificio: link personale, da aggiungere alla schermata Home |
| `admin.html?k=ADMIN_KEY` | Amministratore: posizione del portone, QR, link, test |

`config.js` contiene l'URL del motore Apps Script e il brand.

## Motore (Google Apps Script)

Il codice del motore e i dati (persone, telefoni, chiavi) stanno solo nel progetto Apps Script privato, non in questo repository. Le pagine non sono indicizzate dai motori di ricerca (`robots.txt` + meta `noindex`).
