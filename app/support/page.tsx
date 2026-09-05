export const metadata = {
  title: "Support | RideSense",
  description: "Hjelp og kontaktinformasjon for RideSense."
};

const githubIssuesUrl = "https://github.com/MKej88/RideSense/issues";

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-slate-100">
      <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
        ← Tilbake til RideSense
      </a>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">RideSense support</h1>
      <p className="mt-4 leading-relaxed text-slate-300">
        Har du problemer med RideSense, finner feil i vær- eller ruteanalysen eller ønsker å foreslå
        en forbedring, kan du kontakte oss via GitHub.
      </p>

      <div className="mt-8 space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Meld feil eller be om hjelp</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Opprett en sak og beskriv hva du gjorde, hva du forventet og hva som skjedde. Ikke legg
            inn sensitive eller private opplysninger.
          </p>
          <a
            className="mt-4 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            href={githubIssuesUrl}
            target="_blank"
            rel="noreferrer"
          >
            Åpne support på GitHub
          </a>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Ved feil i værdata</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Oppgi sted, omtrent tidspunkt og hvilken verdi som ser feil ut. RideSense kombinerer data
            fra eksterne vær- og karttjenester, og midlertidige avvik kan derfor forekomme.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Personvern</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Les <a href="/privacy" className="text-cyan-300 hover:text-cyan-200">personvernerklæringen</a> for
            informasjon om hvilke opplysninger som behandles og hvordan RideSense bruker eksterne
            datakilder.
          </p>
        </section>
      </div>
    </main>
  );
}
