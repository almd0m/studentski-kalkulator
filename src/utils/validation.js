const PASSWORD_LEVELS = ["Slaba", "Srednja", "Jaka", "Vrlo jaka"];

export function getSubjectStatusFromGrade(grade) {
  const numericGrade = Number(grade);

  if (!Number.isInteger(numericGrade) || numericGrade < 5 || numericGrade > 10) {
    return "";
  }

  return numericGrade === 5 ? "failed" : "passed";
}

export function normalizeSubjectForm(form) {
  const grade = form.grade === "" ? null : Number(form.grade);

  return {
    name: form.name.trim(),
    ects: Number(form.ects),
    grade,
    status: getSubjectStatusFromGrade(grade)
  };
}

export function applySubjectGrade(form, grade) {
  return {
    ...form,
    grade,
    status: getSubjectStatusFromGrade(grade) || form.status
  };
}

export function validateSubject(values) {
  if (!values.name) {
    return "Naziv predmeta ne smije biti prazan.";
  }

  if (!Number.isFinite(values.ects) || values.ects <= 0) {
    return "ECTS mora biti veći od 0.";
  }

  if (!Number.isInteger(values.grade) || values.grade < 5 || values.grade > 10) {
    return "Ocjena mora biti od 5 do 10.";
  }

  if (values.grade === 5 && values.status !== "failed") {
    return "Ocjena 5 uvijek znači da je predmet pao.";
  }

  if (values.grade >= 6 && values.grade <= 10 && values.status !== "passed") {
    return "Ocjena od 6 do 10 uvijek znači da je predmet položen.";
  }

  return "";
}

export function getPasswordStrength(password, email = "", name = "") {
  const normalizedPassword = password.toLowerCase();
  const normalizedEmail = email.toLowerCase();
  const emailUser = normalizedEmail.split("@")[0] || "";
  const normalizedName = name.toLowerCase().trim();
  const weakPatterns = ["123456", "12345678", "password", "qwerty", "abcdef", "111111", "lozinka"];
  let score = 0;
  const issues = [];

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (password.length < 8) {
    issues.push("Lozinka mora imati najmanje 8 karaktera.");
  }

  if (weakPatterns.some((pattern) => normalizedPassword.includes(pattern))) {
    score = Math.min(score, 1);
    issues.push("Izbjegni jednostavne obrasce kao 123456, password ili qwerty.");
  }

  if (emailUser.length >= 3 && normalizedPassword.includes(emailUser)) {
    score = Math.min(score, 1);
    issues.push("Lozinka ne bi trebala sadržati email adresu.");
  }

  if (normalizedName.length >= 3 && normalizedPassword.includes(normalizedName)) {
    score = Math.min(score, 1);
    issues.push("Lozinka ne bi trebala sadržati ime.");
  }

  const index = password.length === 0 ? 0 : Math.min(3, Math.max(0, score - 1));

  return {
    label: PASSWORD_LEVELS[index],
    score: index,
    isWeak: index === 0,
    issues
  };
}

export function validatePasswordChange(password, confirmPassword, email = "", name = "") {
  const strength = getPasswordStrength(password, email, name);

  if (password.length < 8) {
    return "Lozinka mora imati najmanje 8 karaktera.";
  }

  if (strength.isWeak) {
    return "Lozinka nije dovoljno jaka.";
  }

  if (password !== confirmPassword) {
    return "Potvrda lozinke mora biti ista kao nova lozinka.";
  }

  return "";
}
