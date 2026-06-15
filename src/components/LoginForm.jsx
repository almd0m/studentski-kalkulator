export default function LoginForm({ email, password, busy, message, onEmailChange, onPasswordChange, onSubmit, onForgot }) {
  return (
    <form onSubmit={onSubmit} className="stack-form">
      <label>
        Email
        <input type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required />
      </label>
      <label>
        Lozinka
        <input
          type="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          minLength="6"
          required
        />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Spremanje..." : "Prijavi se"}</button>
      <button className="link-button" type="button" onClick={onForgot}>
        Zaboravili ste lozinku?
      </button>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
