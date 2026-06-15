import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const NAV_ITEMS = [
  { id: "overview", label: "Pregled prosjeka" },
  { id: "studies", label: "Moje studije" },
  { id: "profile", label: "Profil" }
];

const CONTACT_TYPES = ["Greška", "Sugestija", "Pitanje"];

export default function MainLayout({ activeView, onViewChange, onSignOut, userEmail = "", children }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    type: "Greška",
    title: "",
    description: ""
  });
  const [contactMessage, setContactMessage] = useState("");
  const [contactBusy, setContactBusy] = useState(false);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        setIsPrivacyOpen(false);
        setIsContactOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function handleNavigate(viewId) {
    onViewChange(viewId);
    setIsMobileMenuOpen(false);
  }

  function handleSignOut() {
    setIsMobileMenuOpen(false);
    onSignOut();
  }

  function openPrivacyPolicy() {
    setIsMobileMenuOpen(false);
    setIsContactOpen(false);
    setIsPrivacyOpen(true);
  }

  function openContactModal() {
    setIsMobileMenuOpen(false);
    setIsPrivacyOpen(false);
    setContactMessage("");
    setIsContactOpen(true);
  }

  function closeContactModal() {
    if (contactBusy) {
      return;
    }

    setIsContactOpen(false);
    setContactMessage("");
  }

  async function submitContactForm(event) {
    event.preventDefault();
    const description = contactForm.description.trim();

    if (!description) {
      setContactMessage("Unesite kratak opis poruke.");
      return;
    }

    setContactBusy(true);
    setContactMessage("");

    const { error } = await supabase.functions.invoke("contact-support", {
      body: {
        type: contactForm.type,
        title: contactForm.title.trim(),
        description,
        userEmail
      }
    });

    setContactBusy(false);

    if (error) {
      setContactMessage("Došlo je do greške. Pokušajte ponovo.");
      return;
    }

    setContactForm({ type: "Greška", title: "", description: "" });
    setContactMessage("Poruka je poslana.");
  }

  return (
    <main className="app-shell layout-shell">
      <header className="mobile-header">
        <strong>MOJ PROSJEK</strong>
        <button
          className="mobile-menu-button"
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Otvori meni"
          aria-expanded={isMobileMenuOpen}
        >
          <Menu size={22} />
        </button>
      </header>

      <aside className="main-nav" aria-label="Glavna navigacija">
        <div>
          <p className="eyebrow">Moj Prosjek</p>
          <h1>Dashboard</h1>
        </div>

        <nav className="nav-tabs">
          {NAV_ITEMS.map((item) => (
            <a
              className={activeView === item.id ? "active" : ""}
              href={`#${item.id}`}
              key={item.id}
              onClick={(event) => {
                event.preventDefault();
                handleNavigate(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <FooterLinks onContactClick={openContactModal} onPrivacyClick={openPrivacyPolicy} />

        <button className="ghost-button" type="button" onClick={handleSignOut}>
          <LogOut size={18} />
          Odjava
        </button>
      </aside>

      <div
        className={`mobile-menu-overlay ${isMobileMenuOpen ? "open" : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden={!isMobileMenuOpen}
      />

      <aside className={`mobile-menu-drawer ${isMobileMenuOpen ? "open" : ""}`} aria-label="Mobilna navigacija">
        <div className="mobile-menu-head">
          <div>
            <p className="eyebrow">Moj Prosjek</p>
            <h2>Meni</h2>
          </div>
          <button
            className="mobile-menu-button"
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Zatvori meni"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="mobile-menu-links">
          {NAV_ITEMS.map((item) => (
            <a
              className={activeView === item.id ? "active" : ""}
              href={`#${item.id}`}
              key={item.id}
              onClick={(event) => {
                event.preventDefault();
                handleNavigate(item.id);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button className="ghost-button mobile-signout" type="button" onClick={handleSignOut}>
          <LogOut size={18} />
          Odjava
        </button>

        <FooterLinks mobile onContactClick={openContactModal} onPrivacyClick={openPrivacyPolicy} />
      </aside>

      {isPrivacyOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setIsPrivacyOpen(false)}>
          <section
            className="modal-card privacy-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-policy-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <p className="eyebrow">Privatnost</p>
                <h2 id="privacy-policy-title">Politika privatnosti</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setIsPrivacyOpen(false)}>
                Zatvori
              </button>
            </div>

            <div className="privacy-content">
              <section>
                <h3>Koje podatke čuvamo</h3>
                <p>
                  Čuvamo email adresu, ime i prezime, naziv univerziteta, fakulteta i studijskog programa, nivo studija,
                  akademske godine, semestre, predmete, ECTS kredite, ocjene i status predmeta.
                </p>
              </section>

              <section>
                <h3>Zašto čuvamo podatke</h3>
                <p>
                  Podatke koristimo da korisnik može pratiti prosjek, indeks uspješnosti, ECTS kredite, predmete koje
                  prenosi i da može upravljati svojim studijskim podacima.
                </p>
              </section>

              <section>
                <h3>Dijeljenje podataka</h3>
                <p>Podaci se ne prodaju trećim stranama.</p>
              </section>

              <section>
                <h3>Brisanje naloga</h3>
                <p>
                  Korisnik može obrisati nalog iz sekcije Profil. Brisanjem naloga brišu se i povezani studijski podaci.
                </p>
              </section>

              <section>
                <h3>Informativni karakter</h3>
                <p>
                  Rezultati u aplikaciji su informativnog karaktera. Za zvanične obračune, konkurse, stipendije,
                  studentske kredite i domove korisnik treba provjeriti pravila svog fakulteta ili nadležne institucije.
                </p>
              </section>
            </div>
          </section>
        </div>
      )}

      {isContactOpen && (
        <div className="modal-layer" role="presentation" onMouseDown={closeContactModal}>
          <section
            className="modal-card contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <p className="eyebrow">Podrška</p>
                <h2 id="contact-modal-title">Kontakt / prijava greške</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeContactModal} disabled={contactBusy}>
                Zatvori
              </button>
            </div>

            <p className="muted">
              Ako primijetite grešku u računanju, prikazu podataka ili radu aplikacije, možete poslati prijavu.
            </p>

            <form className="stack-form contact-form" onSubmit={submitContactForm}>
              <label>
                Tip poruke
                <select
                  value={contactForm.type}
                  onChange={(event) => setContactForm({ ...contactForm, type: event.target.value })}
                >
                  {CONTACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Naslov
                <input
                  value={contactForm.title}
                  onChange={(event) => setContactForm({ ...contactForm, title: event.target.value })}
                  placeholder="Kratak naslov poruke"
                />
              </label>
              <label>
                Opis poruke
                <textarea
                  value={contactForm.description}
                  onChange={(event) => setContactForm({ ...contactForm, description: event.target.value })}
                  placeholder="Kratko opišite grešku, sugestiju ili pitanje."
                />
              </label>
              {contactMessage && <p className="form-message">{contactMessage}</p>}
              <button type="submit" disabled={contactBusy}>
                {contactBusy ? "Slanje..." : "Pošalji"}
              </button>
            </form>
          </section>
        </div>
      )}

      <section className="main-content">{children}</section>

      <footer className="site-footer">
        <span>© 2026 Moj Prosjek</span>
        <span aria-hidden="true">·</span>
        <span>Designed & developed by Almedin Mekić</span>
      </footer>
    </main>
  );
}

function FooterLinks({ mobile = false, onContactClick, onPrivacyClick }) {
  return (
    <footer className={`app-info-footer ${mobile ? "mobile" : ""}`}>
      <nav aria-label="Informativni linkovi">
        <button className="footer-link" type="button" onClick={onPrivacyClick}>
          Politika privatnosti
        </button>
        <span aria-hidden="true">·</span>
        <button className="footer-link" type="button" onClick={onContactClick}>
          Kontakt / prijava greške
        </button>
      </nav>
    </footer>
  );
}
