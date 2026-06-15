export default function ForgotPasswordForm({ email, busy, message, onEmailChange, onSubmit, onBack }) {
  return (
    <form onSubmit={onSubmit} className="stack-form">
      <label>
        Email
        <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Spremanje..." : "Pošalji link za reset"}</button>
      <button className="link-button" type="button" onClick={onBack}>
        Nazad na prijavu
      </button>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
