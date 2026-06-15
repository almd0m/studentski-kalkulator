export default function PasswordStrengthMeter({ strength }) {
  return (
    <div className={`password-strength strength-${strength.score}`}>
      <div className="strength-track">
        <span />
      </div>
      <p>
        Jačina lozinke: <strong>{strength.label}</strong>
      </p>
      {strength.issues[0] && <small>{strength.issues[0]}</small>}
    </div>
  );
}
