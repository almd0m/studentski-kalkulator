export function logAuthError(error) {
  if (import.meta.env.DEV && error) {
    console.error(error);
  }
}

export function getFriendlyAuthError(error) {
  const message = `${error?.message || ""} ${error?.name || ""}`.toLowerCase();

  logAuthError(error);

  if (message.includes("invalid login") || message.includes("invalid_grant") || message.includes("credentials")) {
    return "Email ili lozinka nisu ispravni.";
  }

  if (message.includes("jwt") || message.includes("expired") || message.includes("session")) {
    return "Sesija je istekla. Prijavite se ponovo.";
  }

  if (message.includes("email")) {
    return "Provjerite email adresu i pokušajte ponovo.";
  }

  if (message.includes("password") || message.includes("weak")) {
    return "Lozinka nije dovoljno jaka.";
  }

  return "Došlo je do greške. Pokušajte ponovo.";
}
