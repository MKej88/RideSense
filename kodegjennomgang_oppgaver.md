# Kodegjennomgang – foreslåtte oppgaver

Denne gjennomgangen foreslår fire konkrete oppgaver: én skrivefeil, én bug, én dokumentasjons-/kommentaravvik og én testforbedring.

## 1) Oppgave: Fiks skrivefeil/tekstinkonsistens i README

**Problem (enkelt forklart):**
I README brukes både «stedssøk» og «sted/adressesøk». Det blir litt ujevnt språk og kan se ut som en skrivefeil for brukere.

**Hvor:**
- `README.md` (seksjonen med API-endepunkter)

**Forslag til løsning:**
- Bytt «sted/adressesøk» til en mer konsekvent formulering, for eksempel «steds- og adressesøk».
- Gå over README for samme type små tekstinkonsistenser.

**Akseptansekriterier:**
- README bruker samme begrep konsekvent i hele dokumentet.
- Ingen uklare eller blandede formuleringer rundt sted/adresse-søk.

---

## 2) Oppgave: Fiks validerings-bug for koordinater i API

**Problem (enkelt forklart):**
API-et for ruteanalyse sjekker at koordinater er tall, men ikke om de faktisk er gyldige geografiske koordinater. Da kan ugyldige verdier (f.eks. breddegrad 999) slippe gjennom.

**Hvor:**
- `app/api/route-analysis/route.ts`

**Forslag til løsning:**
- Legg til validering:
  - `lat` må være mellom `-90` og `90`
  - `lon` må være mellom `-180` og `180`
- Returner `400` med tydelig feilmelding hvis verdier er utenfor gyldig område.

**Akseptansekriterier:**
- Ugyldige koordinater stopper tidlig med `400`.
- Gyldige koordinater fungerer som før.
- Feilmeldingen forklarer hva som er galt.

---

## 3) Oppgave: Rett dokumentasjonsavvik mellom README og faktisk ruteanalyse

**Problem (enkelt forklart):**
README beskriver ruteanalyse som «1–3 tur/retur-ruter med min/maks km». Grensesnitt/API ser nå ut til å analysere valgt start- og stoppadresse (brukervalgt rute), ikke den samme flyten som README beskriver.

**Hvor:**
- `README.md` (seksjonen «Ruteanalyse (1–3 ruter)»)
- `app/api/route-analysis/route.ts` (tar `startLat/startLon/stopLat/stopLon`)
- `app/page.tsx` (UI med startadresse + stoppadresse)

**Forslag til løsning:**
- Oppdater README så den beskriver dagens løsning korrekt.
- Hvis begge flyter finnes/skal finnes, dokumenter tydelig forskjellen og hvilke parametere som brukes.

**Akseptansekriterier:**
- README samsvarer med faktisk funksjonalitet i UI og API.
- Bruker skjønner uten kodekunnskap hvordan ruteanalyse fungerer nå.

---

## 4) Oppgave: Forbedre tester med enkel Python-basert API-smoketest

**Problem (enkelt forklart):**
Prosjektet har lint og typecheck, men ingen tydelig automatisert testkommando for funksjonell oppførsel. Da er det lettere at regresjoner slipper inn.

**Hvor:**
- `package.json` (mangler test-script)
- Ny testmappe, f.eks. `tests/` med pytest

**Forslag til løsning (Python-vennlig):**
- Lag enkle `pytest`-smoketester som kaller API-rutene og verifiserer:
  1. `GET /api/weather` returnerer `400` ved manglende/ugyldig lat/lon.
  2. `GET /api/route-analysis` returnerer `400` ved ugyldig start/stopp-koordinater.
  3. Gyldig kall returnerer JSON med forventede felter (`hours`, `route`, osv.).
- Hold testene små og lesbare.

**Akseptansekriterier:**
- `pytest` kan kjøres lokalt og gir tydelig grønt/rødt svar.
- Minst én negativ og én positiv test per API-rute som er kritisk.
- Tester dokumenteres kort i README under «Nyttige kommandoer».
