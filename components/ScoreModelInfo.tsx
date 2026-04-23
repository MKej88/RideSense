import { useState } from "react";

export function ScoreModelInfo() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-xl border border-cyan-300/25 bg-slate-900 p-4 text-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-cyan-100">Slik fungerer værscoren</h3>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-md border border-cyan-300/35 bg-slate-800 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-slate-700"
        >
          {isOpen ? "Skjul" : "Les mer"}
        </button>
      </div>

      {isOpen ? (
        <>
          <p className="mt-3 text-sm text-slate-300">
            Perfekt score er <strong>100/100</strong> og betyr omtrent:{" "}
            <strong>18–22°C</strong>, <strong>tørt vær</strong>,{" "}
            <strong>vindstille</strong> og <strong>lite skyer</strong>.
          </p>

          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/55 p-3">
            <p className="text-sm font-medium text-slate-100">Tolkning av endelig score</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-300">
              <li>
                <strong>80–100 (Bra):</strong> Gode sykkelforhold for de fleste.
              </li>
              <li>
                <strong>60–79 (Ok):</strong> Helt greit, men sjekk vind og nedbør.
              </li>
              <li>
                <strong>40–59 (Dårlig):</strong> Mer krevende forhold, vurder kortere tur.
              </li>
              <li>
                <strong>0–39 (Svært dårlig):</strong> Frarådes for de fleste sykkelturer.
              </li>
            </ul>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <strong>Temperatur (0–40 poeng):</strong> Full score mellom 18 og 22°C.
              Utenfor idealområdet trekkes 4 poeng per grad.
            </li>
            <li>
              <strong>Nedbør (0–30 poeng):</strong> 30 poeng ved opphold. Nedbør trekker
              15 poeng per mm/time.
            </li>
            <li>
              <strong>Vind (0–20 poeng):</strong> 20 poeng ved 0 m/s. Trekker 2 poeng per
              m/s.
            </li>
            <li>
              <strong>Vindkast (0 til -15 poeng):</strong> Hvis prognosen har vindkast, trekkes
              ekstra poeng ved kraftige kast. Små kast gir lite trekk, mens sikkerhetskritiske
              kast trekker mer. Rundt 15 m/s bør du vurdere skjermet rute, og fra ca. 17 m/s
              frarådes landeveissykling.
            </li>
            <li>
              <strong>Skydekke (0–10 poeng):</strong> Klar himmel gir 10 poeng, tett skydekke
              gir 0 poeng.
            </li>
          </ul>
        </>
      ) : null}
    </section>
  );
}
