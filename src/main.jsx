import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  LogOut,
  Plus,
  Trash2,
  XCircle
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import "./styles.css";

const ACADEMIC_YEARS = Array.from({ length: new Date().getFullYear() - 2010 + 1 }, (_, index) => {
  const startYear = 2010 + index;
  return `${startYear}/${startYear + 1}`;
}).reverse();

const ECTS_OPTIONS = {
  bachelor: [180, 240],
  master: [60, 120]
};

const DEGREE_LABELS = {
  bachelor: "Osnovne studije",
  master: "Master"
};

const SUBJECT_STATUSES = {
  passed: "Polozen",
  failed: "Pao",
  planned: "Planiran"
};

const PASSWORD_LEVELS = ["Slaba", "Srednja", "Jaka", "Vrlo jaka"];

function calculateStats(subjects) {
  const passedSubjects = subjects.filter((subject) => subject.status === "passed");
  const failedSubjects = subjects.filter((subject) => subject.status === "failed");
  const plannedSubjects = subjects.filter((subject) => subject.status === "planned");
  const attemptedEcts = subjects.reduce((sum, subject) => sum + Number(subject.ects), 0);
  const earnedEcts = passedSubjects.reduce((sum, subject) => sum + Number(subject.ects), 0);
  const failedEcts = failedSubjects.reduce((sum, subject) => sum + Number(subject.ects), 0);
  const averageDenominator = failedSubjects.length > 0 ? earnedEcts + failedEcts : earnedEcts;
  const weightedSum = passedSubjects.reduce(
    (sum, subject) => sum + Number(subject.grade) * Number(subject.ects),
    0
  );

  return {
    average: averageDenominator > 0 ? weightedSum / averageDenominator : 0,
    weightedSum,
    attemptedEcts,
    earnedEcts,
    failedEcts,
    passedSubjects,
    failedSubjects,
    plannedSubjects
  };
}

function calculateProgress(earnedEcts, totalEcts) {
  if (!totalEcts) {
    return 0;
  }

  return Math.min(100, (earnedEcts / Number(totalEcts)) * 100);
}

function normalizeSubjectForm(form) {
  return {
    name: form.name.trim(),
    ects: Number(form.ects),
    grade: form.grade === "" ? null : Number(form.grade),
    status: form.status
  };
}

function validateSubject(values) {
  if (!values.name) {
    return "Naziv predmeta ne smije biti prazan.";
  }

  if (!Number.isFinite(values.ects) || values.ects <= 0) {
    return "ECTS mora biti veci od 0.";
  }

  if (values.status === "passed" && (!Number.isInteger(values.grade) || values.grade < 6 || values.grade > 10)) {
    return "Za polozen predmet ocjena mora biti od 6 do 10.";
  }

  if (values.status === "failed" && values.grade !== null && values.grade !== 5) {
    return "Za nepolozen predmet ocjena moze biti 5 ili prazna.";
  }

  if (values.status === "planned" && values.grade !== null) {
    return "Planirani predmet ne moze imati ocjenu.";
  }

  return "";
}

function logAuthError(error) {
  if (import.meta.env.DEV && error) {
    console.error(error);
  }
}

function getFriendlyAuthError(error) {
  const message = `${error?.message || ""} ${error?.name || ""}`.toLowerCase();

  logAuthError(error);

  if (message.includes("invalid login") || message.includes("invalid_grant") || message.includes("credentials")) {
    return "Email ili lozinka nisu ispravni.";
  }

  if (message.includes("jwt") || message.includes("expired") || message.includes("session")) {
    return "Sesija je istekla. Prijavite se ponovo.";
  }

  if (message.includes("email")) {
    return "Provjerite email adresu i pokusajte ponovo.";
  }

  if (message.includes("password") || message.includes("weak")) {
    return "Lozinka nije dovoljno jaka.";
  }

  return "Doslo je do greske. Pokusajte ponovo.";
}

function getPasswordStrength(password, email = "", name = "") {
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
    issues.push("Lozinka ne bi trebala sadrzati email adresu.");
  }

  if (normalizedName.length >= 3 && normalizedPassword.includes(normalizedName)) {
    score = Math.min(score, 1);
    issues.push("Lozinka ne bi trebala sadrzati ime.");
  }

  const index = password.length === 0 ? 0 : Math.min(3, Math.max(0, score - 1));

  return {
    label: PASSWORD_LEVELS[index],
    score: index,
    isWeak: index === 0,
    issues
  };
}

function validatePasswordChange(password, confirmPassword, email = "", name = "") {
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

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getAcademicYearName(startAcademicYear, yearIndex) {
  const startYear = Number(startAcademicYear.slice(0, 4)) + yearIndex;
  return `${startYear}/${startYear + 1}`;
}

function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoadingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return <SetupNotice />;
  }

  if (loadingSession) {
    return <main className="center-page">Ucitavanje...</main>;
  }

  if (window.location.pathname === "/reset-password") {
    return <ResetPasswordPage session={session} />;
  }

  return session ? <StudentApp session={session} /> : <AuthPage />;
}

function SetupNotice() {
  return (
    <main className="center-page">
      <section className="auth-card">
        <p className="eyebrow">Konfiguracija</p>
        <h1>Moj Prosjek</h1>
        <p className="muted">
          Napravi <code>.env</code> fajl prema <code>.env.example</code> i unesi Supabase URL i anon key.
          Zatim u Supabase SQL editoru pokreni <code>supabase.sql</code> i <code>supabase_onboarding_migration.sql</code>.
        </p>
      </section>
    </main>
  );
}

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordStrength = getPasswordStrength(password, email);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) {
        logAuthError(error);
      }

      setBusy(false);
      setMessage("Ako nalog sa ovom email adresom postoji, poslat je link za resetovanje lozinke.");
      return;
    }

    if (mode === "register") {
      const passwordError = validatePasswordChange(password, confirmPassword, email);

      if (passwordError) {
        setBusy(false);
        setMessage(passwordError);
        return;
      }
    }

    const authCall =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await authCall;
    setBusy(false);

    if (error) {
      setMessage(getFriendlyAuthError(error));
      return;
    }

    if (mode === "register") {
      setMessage("Nalog je kreiran. Provjerite email i potvrdite registraciju.");
    }
  }

  return (
    <main className="center-page">
      <section className="auth-card">
        <p className="eyebrow">Studentski dashboard</p>
        <h1>Moj Prosjek</h1>
        <div className="auth-tabs" aria-label="Autentifikacija">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Prijava
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Registracija
          </button>
        </div>
        <form onSubmit={handleSubmit} className="stack-form">
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {mode !== "forgot" && (
            <label>
              Lozinka
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "register" ? "8" : "6"}
                required
              />
            </label>
          )}
          {mode === "register" && (
            <>
              <PasswordStrengthMeter strength={passwordStrength} />
              <label>
                Potvrdi lozinku
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength="8"
                  required
                />
              </label>
            </>
          )}
          <button type="submit" disabled={busy}>
            {busy
              ? "Sacekaj..."
              : mode === "login"
                ? "Prijavi se"
                : mode === "register"
                  ? "Registruj se"
                  : "Posalji link za reset"}
          </button>
          {mode === "login" && (
            <button className="link-button" type="button" onClick={() => setMode("forgot")}>
              Zaboravili ste lozinku?
            </button>
          )}
          {mode === "forgot" && (
            <button className="link-button" type="button" onClick={() => setMode("login")}>
              Nazad na prijavu
            </button>
          )}
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
    </main>
  );
}

function ResetPasswordPage({ session }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = getPasswordStrength(password, session?.user?.email || "");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const passwordError = validatePasswordChange(password, confirmPassword, session?.user?.email || "");

    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage(getFriendlyAuthError(error));
      return;
    }

    setMessage("Lozinka je uspjesno promijenjena.");

    window.setTimeout(() => {
      window.history.replaceState({}, "", "/");
      window.location.reload();
    }, 1200);
  }

  return (
    <main className="center-page">
      <section className="auth-card">
        <p className="eyebrow">Sigurnost naloga</p>
        <h1>Nova lozinka</h1>
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Nova lozinka
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength="8"
              required
            />
          </label>
          <PasswordStrengthMeter strength={strength} />
          <label>
            Potvrdi novu lozinku
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength="8"
              required
            />
          </label>
          <button type="submit" disabled={busy}>{busy ? "Cuvam..." : "Promijeni lozinku"}</button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
    </main>
  );
}

function PasswordStrengthMeter({ strength }) {
  return (
    <div className={`password-strength strength-${strength.score}`}>
      <div className="strength-track">
        <span />
      </div>
      <p>
        Jacina lozinke: <strong>{strength.label}</strong>
      </p>
      {strength.issues[0] && <small>{strength.issues[0]}</small>}
    </div>
  );
}

function StudentApp({ session }) {
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAppData();
  }, []);

  async function loadAppData() {
    setLoading(true);
    setError("");

    const profileResult = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileResult.error) {
      setError(getFriendlyAuthError(profileResult.error));
      setLoading(false);
      return;
    }

    let loadedProfile = profileResult.data;

    if (!loadedProfile) {
      const { data, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: session.user.id,
          email: session.user.email,
          full_name: null,
          onboarding_completed: false
        })
        .select()
        .single();

      if (insertError) {
        setError(getFriendlyAuthError(insertError));
        setLoading(false);
        return;
      }

      loadedProfile = data;
    }

    setProfile(loadedProfile);

    if (loadedProfile.onboarding_completed) {
      await loadDashboardData();
    }

    setLoading(false);
  }

  async function loadDashboardData() {
    const [programResult, yearsResult, semestersResult, subjectsResult] = await Promise.all([
      supabase.from("study_programs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("academic_years").select("*").order("year_number", { ascending: true }),
      supabase.from("semesters").select("*").order("semester_number", { ascending: true }),
      supabase.from("subjects").select("*").order("created_at", { ascending: true })
    ]);

    if (programResult.error || yearsResult.error || semestersResult.error || subjectsResult.error) {
      setError(
        getFriendlyAuthError(programResult.error || yearsResult.error || semestersResult.error || subjectsResult.error)
      );
      return;
    }

    setProgram(programResult.data);
    setAcademicYears(yearsResult.data);
    setSemesters(semestersResult.data);
    setSubjects(subjectsResult.data);
  }

  async function handleOnboardingComplete(nextProfile) {
    setProfile(nextProfile);
    await loadDashboardData();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <main className="center-page">Ucitavanje...</main>;
  }

  if (!profile?.onboarding_completed) {
    return (
      <Onboarding
        session={session}
        onComplete={handleOnboardingComplete}
        onSignOut={signOut}
        initialError={error}
      />
    );
  }

  return (
    <Dashboard
      session={session}
      program={program}
      profile={profile}
      academicYears={academicYears}
      semesters={semesters}
      subjects={subjects}
      setProfile={setProfile}
      setProgram={setProgram}
      setSubjects={setSubjects}
      error={error}
      setError={setError}
      onSignOut={signOut}
    />
  );
}

function Onboarding({ session, onComplete, onSignOut, initialError }) {
  const [fullName, setFullName] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [programName, setProgramName] = useState("");
  const [studyLevel, setStudyLevel] = useState("bachelor");
  const [startAcademicYear, setStartAcademicYear] = useState(ACADEMIC_YEARS[0]);
  const [totalEcts, setTotalEcts] = useState(180);
  const [semesterEctsDefault, setSemesterEctsDefault] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");

  const totalSemesters = Number(totalEcts) / Number(semesterEctsDefault);
  const totalYears = Math.ceil(totalSemesters / 2);

  function updateStudyLevel(nextStudyLevel) {
    setStudyLevel(nextStudyLevel);
    setTotalEcts(ECTS_OPTIONS[nextStudyLevel][0]);
  }

  async function createStudyPlan(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    if (fullName.trim().length < 2) {
      setError("Ime i prezime mora imati najmanje 2 karaktera.");
      setBusy(false);
      return;
    }

    if (!universityName.trim() || !facultyName.trim() || !programName.trim()) {
      setError("Unesi univerzitet, fakultet i naziv studijskog programa.");
      setBusy(false);
      return;
    }

    if (!startAcademicYear) {
      setError("Odaberi pocetnu akademsku godinu.");
      setBusy(false);
      return;
    }

    if (!Number.isFinite(Number(semesterEctsDefault)) || Number(semesterEctsDefault) <= 0) {
      setError("ECTS po semestru mora biti veci od 0.");
      setBusy(false);
      return;
    }

    const semestersCount = Number(totalEcts) / Number(semesterEctsDefault);

    if (!Number.isInteger(semestersCount)) {
      setError("Ukupni ECTS mora biti djeljiv sa ECTS vrijednoscu po semestru.");
      setBusy(false);
      return;
    }

    const { data: createdProgram, error: programError } = await supabase
      .from("study_programs")
      .insert({
        user_id: session.user.id,
        university_name: universityName.trim(),
        faculty_name: facultyName.trim(),
        program_name: programName.trim(),
        study_level: studyLevel,
        degree_type: studyLevel,
        start_academic_year: startAcademicYear,
        total_ects: Number(totalEcts),
        total_semesters: semestersCount,
        semester_ects_default: Number(semesterEctsDefault)
      })
      .select()
      .single();

    if (programError) {
      setError(getFriendlyAuthError(programError));
      setBusy(false);
      return;
    }

    const yearsToCreate = Array.from({ length: Math.ceil(semestersCount / 2) }, (_, index) => ({
      user_id: session.user.id,
      program_id: createdProgram.id,
      name: getAcademicYearName(startAcademicYear, index),
      year_number: index + 1
    }));

    const { data: createdYears, error: yearsError } = await supabase
      .from("academic_years")
      .insert(yearsToCreate)
      .select();

    if (yearsError) {
      setError(getFriendlyAuthError(yearsError));
      setBusy(false);
      return;
    }

    const semestersToCreate = Array.from({ length: semestersCount }, (_, index) => {
      const semesterNumber = index + 1;
      const yearNumber = Math.ceil(semesterNumber / 2);
      const academicYear = createdYears.find((year) => year.year_number === yearNumber);

      return {
        user_id: session.user.id,
        program_id: createdProgram.id,
        academic_year_id: academicYear.id,
        academic_year: academicYear.name,
        name: `${semesterNumber}. semestar`,
        semester_number: semesterNumber,
        target_ects: Number(semesterEctsDefault)
      };
    });

    const { error: semestersError } = await supabase.from("semesters").insert(semestersToCreate);

    if (semestersError) {
      setError(getFriendlyAuthError(semestersError));
      setBusy(false);
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), onboarding_completed: true })
      .eq("id", session.user.id)
      .select()
      .single();

    if (profileError) {
      setError(getFriendlyAuthError(profileError));
      setBusy(false);
      return;
    }

    setBusy(false);
    onComplete(updatedProfile);
  }

  return (
    <main className="center-page">
      <section className="onboarding-card">
        <div className="onboarding-header">
          <div>
            <p className="eyebrow">Podesavanje profila</p>
            <h1>Kreiraj studijski plan</h1>
            <p className="muted">Iz ovih podataka automatski nastaju akademske godine i semestri.</p>
          </div>
          <button className="ghost-button" type="button" onClick={onSignOut}>
            <LogOut size={18} />
            Odjava
          </button>
        </div>

        {error && <p className="alert">{error}</p>}

        <form className="onboarding-form" onSubmit={createStudyPlan}>
          <label>
            Ime i prezime
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Amina Hadzic"
              required
            />
          </label>

          <label>
            Univerzitet
            <input
              value={universityName}
              onChange={(event) => setUniversityName(event.target.value)}
              placeholder="University of Oxford"
              required
            />
          </label>

          <label>
            Fakultet
            <input
              value={facultyName}
              onChange={(event) => setFacultyName(event.target.value)}
              placeholder="Faculty of Law"
              required
            />
          </label>

          <label>
            Studijski program
            <input
              value={programName}
              onChange={(event) => setProgramName(event.target.value)}
              placeholder="Law"
              required
            />
          </label>

          <label>
            Nivo studija
            <select value={studyLevel} onChange={(event) => updateStudyLevel(event.target.value)}>
              <option value="bachelor">Bachelor / osnovne</option>
              <option value="master">Master</option>
            </select>
          </label>

          <label>
            Pocetna akademska godina
            <select value={startAcademicYear} onChange={(event) => setStartAcademicYear(event.target.value)}>
              {ACADEMIC_YEARS.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ukupno ECTS kredita
            <select value={totalEcts} onChange={(event) => setTotalEcts(Number(event.target.value))}>
              {ECTS_OPTIONS[studyLevel].map((ects) => (
                <option key={ects} value={ects}>
                  {ects} ECTS
                </option>
              ))}
            </select>
          </label>

          <label>
            ECTS po semestru
            <input
              type="number"
              min="1"
              step="1"
              value={semesterEctsDefault}
              onChange={(event) => setSemesterEctsDefault(Number(event.target.value))}
            />
          </label>

          <section className="plan-preview">
            <StatCard label="Broj semestara" value={totalSemesters} />
            <StatCard label="Broj akademskih godina" value={totalYears} />
            <StatCard label="ECTS po semestru" value={semesterEctsDefault} />
          </section>

          <button type="submit" disabled={busy}>
            <GraduationCap size={18} />
            {busy ? "Kreiram..." : "Kreiraj moj studijski plan"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({
  session,
  program,
  profile,
  academicYears,
  semesters,
  subjects,
  setProfile,
  setProgram,
  setSubjects,
  error,
  setError,
  onSignOut
}) {
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(academicYears[0]?.id || "");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || "",
    university_name: program?.university_name || "",
    faculty_name: program?.faculty_name || "",
    program_name: program?.program_name || "",
    study_level: program?.study_level || program?.degree_type || "bachelor",
    start_academic_year: program?.start_academic_year || ACADEMIC_YEARS[0]
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: ""
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    ects: "",
    grade: "",
    status: "passed"
  });
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectForm, setEditSubjectForm] = useState({
    name: "",
    ects: "",
    grade: "",
    status: "passed"
  });

  const yearSemesters = semesters.filter((semester) => semester.academic_year_id === selectedAcademicYearId);
  const yearSemesterIds = new Set(yearSemesters.map((semester) => semester.id));
  const yearSubjects = subjects.filter((subject) => yearSemesterIds.has(subject.semester_id));
  const selectedSemester = semesters.find((semester) => semester.id === selectedSemesterId) || yearSemesters[0];
  const selectedSubjects = subjects.filter((subject) => subject.semester_id === selectedSemester?.id);
  const totalStats = useMemo(() => calculateStats(subjects), [subjects]);
  const yearStats = useMemo(() => calculateStats(yearSubjects), [yearSubjects]);
  const semesterStats = useMemo(() => calculateStats(selectedSubjects), [selectedSubjects]);
  const programStudyLevel = program?.study_level || program?.degree_type;
  const progress = calculateProgress(totalStats.earnedEcts, program?.total_ects);
  const greetingName = profile?.full_name || session.user.email;
  const newPasswordStrength = getPasswordStrength(passwordForm.password, session.user.email, profile?.full_name || "");

  useEffect(() => {
    if (!selectedAcademicYearId && academicYears[0]) {
      setSelectedAcademicYearId(academicYears[0].id);
    }
  }, [academicYears, selectedAcademicYearId]);

  useEffect(() => {
    const currentStillVisible = yearSemesters.some((semester) => semester.id === selectedSemesterId);

    if (!currentStillVisible) {
      setSelectedSemesterId(yearSemesters[0]?.id || "");
    }
  }, [selectedAcademicYearId, semesters]);

  async function updateProfileAndProgram(event) {
    event.preventDefault();
    setError("");
    setProfileMessage("");

    if (profileForm.full_name.trim().length < 2) {
      setError("Ime i prezime mora imati najmanje 2 karaktera.");
      return;
    }

    const [profileResult, programResult] = await Promise.all([
      supabase
        .from("profiles")
        .update({ full_name: profileForm.full_name.trim() })
        .eq("id", session.user.id)
        .select()
        .single(),
      supabase
        .from("study_programs")
        .update({
          university_name: profileForm.university_name.trim(),
          faculty_name: profileForm.faculty_name.trim(),
          program_name: profileForm.program_name.trim(),
          study_level: profileForm.study_level,
          degree_type: profileForm.study_level,
          start_academic_year: profileForm.start_academic_year
        })
        .eq("id", program.id)
        .select()
        .single()
    ]);

    if (profileResult.error || programResult.error) {
      setError(getFriendlyAuthError(profileResult.error || programResult.error));
      return;
    }

    setProfile(profileResult.data);
    setProgram(programResult.data);
    setProfileMessage("Profil je sacuvan.");
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setPasswordMessage("");

    if (!passwordForm.currentPassword) {
      setPasswordMessage("Unesite trenutnu lozinku.");
      return;
    }

    const passwordError = validatePasswordChange(
      passwordForm.password,
      passwordForm.confirmPassword,
      session.user.email,
      profile?.full_name || ""
    );

    if (passwordError) {
      setPasswordMessage(passwordError);
      return;
    }

    const { error: currentPasswordError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: passwordForm.currentPassword
    });

    if (currentPasswordError) {
      setPasswordMessage("Trenutna lozinka nije ispravna.");
      logAuthError(currentPasswordError);
      return;
    }

    const { error: passwordErrorResponse } = await supabase.auth.updateUser({ password: passwordForm.password });

    if (passwordErrorResponse) {
      setPasswordMessage(getFriendlyAuthError(passwordErrorResponse));
      return;
    }

    setPasswordForm({ currentPassword: "", password: "", confirmPassword: "" });
    setPasswordMessage("Lozinka je uspjesno promijenjena.");
  }

  async function addSubject(event) {
    event.preventDefault();
    setError("");

    if (!selectedSemester?.id) {
      setError("Prvo odaberi semestar.");
      return;
    }

    const values = normalizeSubjectForm(subjectForm);
    const validationError = validateSubject(values);

    if (validationError) {
      setError(validationError);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("subjects")
      .insert({
        user_id: session.user.id,
        semester_id: selectedSemester.id,
        ...values
      })
      .select()
      .single();

    if (insertError) {
      setError(getFriendlyAuthError(insertError));
      return;
    }

    setSubjects((current) => [...current, data]);
    setSubjectForm({ name: "", ects: "", grade: "", status: "passed" });
  }

  function startEditingSubject(subject) {
    setEditingSubjectId(subject.id);
    setEditSubjectForm({
      name: subject.name,
      ects: String(subject.ects),
      grade: subject.grade ?? "",
      status: subject.status
    });
  }

  function cancelEditingSubject() {
    setEditingSubjectId(null);
    setEditSubjectForm({ name: "", ects: "", grade: "", status: "passed" });
  }

  async function updateSubject(subjectId) {
    setError("");

    const values = normalizeSubjectForm(editSubjectForm);
    const validationError = validateSubject(values);

    if (validationError) {
      setError(validationError);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("subjects")
      .update(values)
      .eq("id", subjectId)
      .select()
      .single();

    if (updateError) {
      setError(getFriendlyAuthError(updateError));
      return;
    }

    setSubjects((current) => current.map((subject) => (subject.id === subjectId ? data : subject)));
    cancelEditingSubject();
  }

  async function deleteSubject(subjectId) {
    const { error: deleteError } = await supabase.from("subjects").delete().eq("id", subjectId);

    if (deleteError) {
      setError(getFriendlyAuthError(deleteError));
      return;
    }

    setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
  }

  function updateStatus(status) {
    setSubjectForm((current) => ({
      ...current,
      status,
      grade: status === "planned" ? "" : current.grade
    }));
  }

  function updateEditStatus(status) {
    setEditSubjectForm((current) => ({
      ...current,
      status,
      grade: status === "planned" ? "" : current.grade
    }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Moj Prosjek</p>
          <h1>Dashboard</h1>
          <p className="welcome-text">Dobrodošao, {greetingName}</p>
        </div>
        <button className="ghost-button" type="button" onClick={onSignOut}>
          <LogOut size={18} />
          Odjava
        </button>
      </header>

      {error && <p className="alert">{error}</p>}

      {program && (
        <section className="program-card">
          <div>
            <p className="eyebrow">Studijski program</p>
            <h2>{program.program_name || DEGREE_LABELS[programStudyLevel]}</h2>
            <div className="program-details">
              <span>{program.university_name || "Univerzitet nije unesen"}</span>
              <span>{program.faculty_name || "Fakultet nije unesen"}</span>
              <span>{DEGREE_LABELS[programStudyLevel] || programStudyLevel}</span>
              <span>Start {program.start_academic_year}</span>
              <span>{program.total_ects} ECTS ukupno</span>
              <span>{program.total_semesters} semestara</span>
            </div>
          </div>
          <GraduationCap size={34} />
        </section>
      )}

      <section className="summary-grid">
        <StatCard label="Ukupni prosjek studija" value={totalStats.average ? totalStats.average.toFixed(2) : "-"} />
        <StatCard label="Ukupno osvojeno ECTS" value={formatNumber(totalStats.earnedEcts)} />
        <StatCard label="Ukupno planirano ECTS" value={formatNumber(Number(program?.total_ects || 0))} />
        <StatCard label="Nepolozeno ECTS" value={formatNumber(totalStats.failedEcts)} />
        <StatCard label="Procenat zavrsenih studija" value={`${progress.toFixed(0)}%`} />
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Profil i studijski program</h2>
            <p>Tekstualne podatke mozes mijenjati bez rekreiranja semestara.</p>
          </div>
        </div>
        <form className="settings-form" onSubmit={updateProfileAndProgram}>
          <label>
            Ime i prezime
            <input
              value={profileForm.full_name}
              onChange={(event) => setProfileForm({ ...profileForm, full_name: event.target.value })}
            />
          </label>
          <label>
            Univerzitet
            <input
              value={profileForm.university_name}
              onChange={(event) => setProfileForm({ ...profileForm, university_name: event.target.value })}
            />
          </label>
          <label>
            Fakultet
            <input
              value={profileForm.faculty_name}
              onChange={(event) => setProfileForm({ ...profileForm, faculty_name: event.target.value })}
            />
          </label>
          <label>
            Studijski program
            <input
              value={profileForm.program_name}
              onChange={(event) => setProfileForm({ ...profileForm, program_name: event.target.value })}
            />
          </label>
          <label>
            Nivo studija
            <select
              value={profileForm.study_level}
              onChange={(event) => setProfileForm({ ...profileForm, study_level: event.target.value })}
            >
              <option value="bachelor">Bachelor / osnovne</option>
              <option value="master">Master</option>
            </select>
          </label>
          <label>
            Pocetna akademska godina
            <select
              value={profileForm.start_academic_year}
              onChange={(event) => setProfileForm({ ...profileForm, start_academic_year: event.target.value })}
            >
              {ACADEMIC_YEARS.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Sacuvaj profil</button>
        </form>
        <p className="warning-note">
          Ukupni ECTS se ne mijenja ovdje jer promjena moze uticati na strukturu vec kreiranih semestara i predmeta.
        </p>
        {profileMessage && <p className="success-message">{profileMessage}</p>}

        <div className="divider" />

        <div className="section-title">
          <div>
            <h2>Promijeni lozinku</h2>
            <p>Koristi najmanje 8 karaktera; preporuceno je 12 ili vise.</p>
          </div>
        </div>
        <form className="settings-form password-settings" onSubmit={changePassword}>
          <label>
            Trenutna lozinka
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
              required
            />
          </label>
          <label>
            Nova lozinka
            <input
              type="password"
              value={passwordForm.password}
              onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
              minLength="8"
            />
          </label>
          <label>
            Potvrdi novu lozinku
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
              minLength="8"
            />
          </label>
          <button type="submit">Promijeni lozinku</button>
        </form>
        <PasswordStrengthMeter strength={newPasswordStrength} />
        {passwordMessage && <p className="form-message">{passwordMessage}</p>}
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Napredak kroz studije</h2>
            <p>{formatNumber(totalStats.earnedEcts)} od {formatNumber(Number(program?.total_ects || 0))} ECTS</p>
          </div>
          <div className="semester-average">{progress.toFixed(0)}%</div>
        </div>
        <div className="progress-bar" aria-label="Procenat zavrsenih studija">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Akademske godine</h2>
            <p>Semestri su automatski kreirani iz studijskog plana.</p>
          </div>
        </div>

        <div className="year-tabs">
          {academicYears.map((academicYear) => (
            <button
              className={academicYear.id === selectedAcademicYearId ? "active" : ""}
              key={academicYear.id}
              type="button"
              onClick={() => setSelectedAcademicYearId(academicYear.id)}
            >
              {academicYear.name}
            </button>
          ))}
        </div>

        <section className="summary-grid compact">
          <StatCard label="Prosjek godine" value={yearStats.average ? yearStats.average.toFixed(2) : "-"} />
          <StatCard label="Osvojeno ECTS u godini" value={formatNumber(yearStats.earnedEcts)} />
          <StatCard label="Nepolozeno ECTS u godini" value={formatNumber(yearStats.failedEcts)} />
        </section>

        <div className="semester-grid">
          {yearSemesters.map((semester) => {
            const stats = calculateStats(subjects.filter((subject) => subject.semester_id === semester.id));

            return (
              <button
                className={`semester-card ${semester.id === selectedSemester?.id ? "active" : ""}`}
                key={semester.id}
                onClick={() => setSelectedSemesterId(semester.id)}
                type="button"
              >
                <span>{semester.target_ects} ciljnih ECTS</span>
                <strong>{semester.name}</strong>
                <small>
                  Prosjek {stats.average ? stats.average.toFixed(2) : "-"} · {formatNumber(stats.earnedEcts)} ECTS
                </small>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSemester && (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>{selectedSemester.name}</h2>
              <p>
                {academicYears.find((year) => year.id === selectedSemester.academic_year_id)?.name} · cilj{" "}
                {formatNumber(Number(selectedSemester.target_ects))} ECTS
              </p>
            </div>
            <div className="semester-average">Prosjek {semesterStats.average ? semesterStats.average.toFixed(2) : "-"}</div>
          </div>

          <section className="summary-grid compact">
            <StatCard label="Osvojeno ECTS" value={formatNumber(semesterStats.earnedEcts)} />
            <StatCard label="Prijavljeno ECTS" value={formatNumber(semesterStats.attemptedEcts)} />
            <StatCard label="Nepolozeno ECTS" value={formatNumber(semesterStats.failedEcts)} />
          </section>

          <form className="subject-form" onSubmit={addSubject}>
            <label>
              Predmet
              <input
                value={subjectForm.name}
                onChange={(event) => setSubjectForm({ ...subjectForm, name: event.target.value })}
                placeholder="Programiranje"
              />
            </label>
            <label>
              ECTS
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={subjectForm.ects}
                onChange={(event) => setSubjectForm({ ...subjectForm, ects: event.target.value })}
                placeholder="6"
              />
            </label>
            <label>
              Status
              <select value={subjectForm.status} onChange={(event) => updateStatus(event.target.value)}>
                <option value="passed">Polozen</option>
                <option value="failed">Pao</option>
                <option value="planned">Planiran</option>
              </select>
            </label>
            <label>
              Ocjena
              <input
                type="number"
                min={subjectForm.status === "failed" ? "5" : "6"}
                max="10"
                value={subjectForm.grade}
                disabled={subjectForm.status === "planned"}
                onChange={(event) => setSubjectForm({ ...subjectForm, grade: event.target.value })}
                placeholder={subjectForm.status === "planned" ? "-" : "8"}
              />
            </label>
            <button type="submit">
              <Plus size={18} />
              Dodaj predmet
            </button>
          </form>

          <SubjectTable
            subjects={selectedSubjects}
            editingSubjectId={editingSubjectId}
            editSubjectForm={editSubjectForm}
            setEditSubjectForm={setEditSubjectForm}
            onEdit={startEditingSubject}
            onUpdate={updateSubject}
            onCancel={cancelEditingSubject}
            onDelete={deleteSubject}
            onEditStatusChange={updateEditStatus}
          />
          <SubjectLists stats={semesterStats} />
        </section>
      )}

    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SubjectTable({
  subjects,
  editingSubjectId,
  editSubjectForm,
  setEditSubjectForm,
  onEdit,
  onUpdate,
  onCancel,
  onDelete,
  onEditStatusChange
}) {
  if (subjects.length === 0) {
    return <p className="empty">U ovom semestru jos nema predmeta.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Predmet</th>
            <th>ECTS</th>
            <th>Ocjena</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.id}>
              {editingSubjectId === subject.id ? (
                <>
                  <td>
                    <input
                      value={editSubjectForm.name}
                      onChange={(event) => setEditSubjectForm({ ...editSubjectForm, name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={editSubjectForm.ects}
                      onChange={(event) => setEditSubjectForm({ ...editSubjectForm, ects: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={editSubjectForm.status === "failed" ? "5" : "6"}
                      max="10"
                      value={editSubjectForm.grade}
                      disabled={editSubjectForm.status === "planned"}
                      onChange={(event) => setEditSubjectForm({ ...editSubjectForm, grade: event.target.value })}
                    />
                  </td>
                  <td>
                    <select value={editSubjectForm.status} onChange={(event) => onEditStatusChange(event.target.value)}>
                      <option value="passed">Polozen</option>
                      <option value="failed">Pao</option>
                      <option value="planned">Planiran</option>
                    </select>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => onUpdate(subject.id)}>Sacuvaj</button>
                      <button className="ghost-button" type="button" onClick={onCancel}>Otkazi</button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td>{subject.name}</td>
                  <td>{formatNumber(Number(subject.ects))}</td>
                  <td>{subject.grade ?? "-"}</td>
                  <td>
                    <span className={`status ${subject.status}`}>{SUBJECT_STATUSES[subject.status]}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost-button" type="button" onClick={() => onEdit(subject)}>
                        Uredi
                      </button>
                      <button className="icon-button" type="button" onClick={() => onDelete(subject.id)} aria-label="Obrisi predmet">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectLists({ stats }) {
  return (
    <div className="lists-grid">
      <SubjectList icon={<CheckCircle2 size={18} />} title="Polozeni predmeti" subjects={stats.passedSubjects} />
      <SubjectList icon={<XCircle size={18} />} title="Nepolozeni predmeti" subjects={stats.failedSubjects} />
      <SubjectList icon={<BookOpen size={18} />} title="Planirani predmeti" subjects={stats.plannedSubjects} />
    </div>
  );
}

function SubjectList({ icon, title, subjects }) {
  return (
    <article className="mini-list">
      <h3>
        {icon}
        {title}
      </h3>
      {subjects.length === 0 ? (
        <p>Nema predmeta.</p>
      ) : (
        <ul>
          {subjects.map((subject) => (
            <li key={subject.id}>
              <span>{subject.name}</span>
              <small>{formatNumber(Number(subject.ects))} ECTS</small>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

createRoot(document.getElementById("root")).render(<App />);
