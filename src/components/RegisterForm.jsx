import PasswordStrengthMeter from "./PasswordStrengthMeter";

export default function RegisterForm({
  email,
  password,
  confirmPassword,
  strength,
  busy,
  message,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit
}) {
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
          minLength="8"
          required
        />
      </label>
      <PasswordStrengthMeter strength={strength} />
      <label>
        Potvrdi lozinku
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          minLength="8"
          required
        />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Spremanje..." : "Registruj se"}</button>
      {message && <p className="form-message">{message}</p>}
    </form>
  );
}
