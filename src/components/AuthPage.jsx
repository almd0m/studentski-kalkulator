export default function AuthPageShell({ mode, onModeChange, children }) {
  return (
    <main className="center-page">
      <section className="auth-card">
        <p className="eyebrow">Studentski dashboard</p>
        <h1>Moj Prosjek</h1>
        <div className="auth-tabs" aria-label="Autentifikacija">
          <button className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")} type="button">
            Prijava
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => onModeChange("register")}
            type="button"
          >
            Registracija
          </button>
        </div>
        {children}
      </section>
    </main>
  );
}
