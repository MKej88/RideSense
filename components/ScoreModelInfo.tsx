export function ScoreModelInfo() {
  return (
    <section className="rs-panel rounded-xl p-4 text-slate-200 shadow-sm">
      <h3 className="text-base font-semibold text-cyan-100">Slik fungerer værscoren</h3>
      <p className="mt-2 text-sm text-slate-300">
        Perfekt score er <strong>100/100</strong> og betyr omtrent:{" "}
        <strong>18–22°C</strong>, <strong>tørt vær</strong>, <strong>vindstille</strong> og{" "}
        <strong>lite skyer</strong>.
      </p>

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
    </section>
  );
}
