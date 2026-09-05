export const metadata = {
  title: "Personvern | RideSense",
  description: "Personvernerklæring for RideSense."
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-slate-100">
      <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
        ← Tilbake til RideSense
      </a>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Personvernerklæring</h1>
      <p className="mt-3 text-sm text-slate-400">Sist oppdatert: 5. september 2026</p>

      <div className="mt-8 space-y-8 leading-relaxed text-slate-200">
        <section>
          <h2 className="text-xl font-semibold text-white">1. Om RideSense</h2>
          <p className="mt-3">
            RideSense er en tjeneste som analyserer værforhold og ruter for å hjelpe brukere med å
            finne gode tidspunkt for sykling. Denne erklæringen beskriver hvordan opplysninger
            behandles når du bruker tjenesten.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">2. Opplysninger som behandles</h2>
          <p className="mt-3">
            RideSense krever ikke brukerkonto og ber ikke om navn, telefonnummer eller andre direkte
            identitetsopplysninger. Når du søker etter et sted eller analyserer en rute, behandles
            søketekst, valgte adresser og geografiske koordinater for å kunne levere resultatet.
          </p>
          <p className="mt-3">
            Appen lagrer lokalt på enheten om introduksjonen i grensesnittet tidligere er lukket.
            Dette brukes bare for å tilpasse visningen og er ikke knyttet til en brukerprofil.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">3. Formål og behandlingsgrunnlag</h2>
          <p className="mt-3">
            Opplysningene behandles for å utføre funksjonene du ber om, som stedssøk, værprognoser,
            kartvisning og ruteanalyse. RideSense bruker ikke disse opplysningene til annonsering,
            profilering eller salg av personopplysninger.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">4. Tredjepartstjenester</h2>
          <p className="mt-3">
            For å levere funksjonaliteten kan RideSense sende nødvendige søkeparametere eller
            koordinater til eksterne datakilder og kart-/værtjenester. Tjenesten kan blant annet bruke
            MET, Kartverket/GeoNorge, OpenStreetMap/Nominatim, Open-Meteo og OSRM. Hvilke tjenester som
            brukes kan endres når RideSense videreutvikles.
          </p>
          <p className="mt-3">
            Disse leverandørene behandler forespørsler etter sine egne vilkår og
            personvernregler. RideSense forsøker å begrense informasjonen som deles til det som er
            nødvendig for å levere funksjonen.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">5. Lagring og tekniske logger</h2>
          <p className="mt-3">
            RideSense har per nå ingen egen brukerdatabase for kontoer eller historikk. Teknisk drift
            av nettstedet kan likevel medføre ordinære server- og sikkerhetslogger hos
            driftsleverandøren. Slike logger brukes for sikkerhet, stabilitet og feilsøking og skal
            ikke brukes til markedsføringsprofiler.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">6. Posisjon</h2>
          <p className="mt-3">
            Dagens RideSense baserer seg på steder, adresser og kartpunkter som brukeren velger. Hvis
            en fremtidig iOS-versjon ber om tilgang til enhetens presise posisjon, skal dette bare
            skje etter uttrykkelig tillatelse fra brukeren, og personvernerklæringen og App Store-
            opplysningene skal oppdateres før funksjonen lanseres.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">7. Dine valg og rettigheter</h2>
          <p className="mt-3">
            Siden RideSense ikke krever konto, finnes det normalt ingen brukerprofil å hente ut eller
            slette. Dersom du mener RideSense har behandlet personopplysninger om deg, eller du har
            spørsmål om personvern, kan du kontakte oss via supportsiden.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">8. Endringer</h2>
          <p className="mt-3">
            Denne erklæringen oppdateres når funksjonalitet, datakilder eller behandlingen av data
            endres. Oppdatert dato vises øverst på siden.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white">9. Kontakt</h2>
          <p className="mt-3">
            Kontakt RideSense via <a className="text-cyan-300 hover:text-cyan-200" href="/support">supportsiden</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
