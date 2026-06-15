import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, GraduationCap, LogOut, XCircle } from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabaseClient";
import AuthPageShell from "./components/AuthPage";
import CarriedSubjectsCard from "./components/CarriedSubjectsCard";
import ForgotPasswordForm from "./components/ForgotPasswordForm";
import LoginForm from "./components/LoginForm";
import MainLayout from "./components/MainLayout";
import PasswordStrengthMeter from "./components/PasswordStrengthMeter";
import RegisterForm from "./components/RegisterForm";
import SubjectForm from "./components/SubjectForm";
import SubjectTable from "./components/SubjectTable";
import {
  calculateProgress,
  calculateStats,
  calculateSuccessIndex,
  getCarriedSubjects,
} from "./utils/calculations";
import { getFriendlyAuthError, logAuthError } from "./utils/authErrors";
import {
  getPasswordStrength,
  normalizeSubjectForm,
  validatePasswordChange,
  validateSubject,
} from "./utils/validation";
import {
  ACADEMIC_YEARS,
  DEGREE_LABELS,
  formatNumber,
} from "./utils/formatting";

const DASHBOARD_VIEWS = new Set(["overview", "studies", "profile"]);
const DEFAULT_START_YEAR = ACADEMIC_YEARS[0];

const STUDY_TYPES = {
  bachelor_3_year: {
    label: "Osnovne studije",
    description: "3 godine, 6 semestara, 180 ECTS",
    studyLevel: "bachelor",
    programEcts: 180,
    previousEcts: 0,
    totalCycleEcts: 180,
    yearsCount: 3,
    semestersCount: 6,
    defaultSemesterEcts: 30,
  },
  master_1_year: {
    label: "Master jednogodišnje studije",
    description: "1 godina, 2 semestra, 60 ECTS + prethodnih 180 ECTS",
    studyLevel: "master",
    programEcts: 60,
    previousEcts: 180,
    totalCycleEcts: 240,
    yearsCount: 1,
    semestersCount: 2,
    defaultSemesterEcts: 30,
  },
  master_2_year: {
    label: "Master dvogodišnji",
    description: "2 godine, 4 semestra, 120 ECTS + prethodnih 180 ECTS",
    studyLevel: "master",
    programEcts: 120,
    previousEcts: 180,
    totalCycleEcts: 300,
    yearsCount: 2,
    semestersCount: 4,
    defaultSemesterEcts: 30,
  },
};

const STUDY_TYPE_OPTIONS = Object.entries(STUDY_TYPES).map(
  ([value, config]) => ({
    value,
    ...config,
  }),
);

function getDashboardViewFromHash() {
  const hashView = window.location.hash.replace("#", "");
  return DASHBOARD_VIEWS.has(hashView) ? hashView : "overview";
}

function getStudyYearLabel(year) {
  return year?.year_number ? `${year.year_number}. godina` : "Godina studija";
}

function getStudyTypeId(program) {
  if (program?.study_type && STUDY_TYPES[program.study_type]) {
    return program.study_type;
  }

  if ((program?.study_level || program?.degree_type) === "master") {
    return Number(program?.total_ects || program?.program_ects) <= 60
      ? "master_1_year"
      : "master_2_year";
  }

  return "bachelor_3_year";
}

export default function App() {
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

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return <SetupNotice />;
  }

  if (loadingSession) {
    return <main className="center-page">Učitavanje podataka...</main>;
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
          Napravi <code>.env</code> fajl prema <code>.env.example</code> i unesi
          Supabase URL i anon key. Zatim u Supabase SQL editoru pokreni{" "}
          <code>supabase/current_schema.sql</code> za novi setup ili najnoviju
          migraciju iz <code>supabase/migrations</code>.
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
  const [message, setMessage] = useState(() => {
    const accountDeletedMessage = window.localStorage.getItem(
      "accountDeletedMessage",
    );
    window.localStorage.removeItem("accountDeletedMessage");
    return accountDeletedMessage || "";
  });
  const [busy, setBusy] = useState(false);
  const passwordStrength = getPasswordStrength(password, email);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        logAuthError(error);
      }

      setBusy(false);
      setMessage(
        "Ako nalog sa ovom email adresom postoji, poslat je link za resetovanje lozinke.",
      );
      return;
    }

    if (mode === "register") {
      const passwordError = validatePasswordChange(
        password,
        confirmPassword,
        email,
      );

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
      setMessage(
        "Nalog je kreiran. Provjerite email i potvrdite registraciju.",
      );
    }
  }

  return (
    <AuthPageShell mode={mode} onModeChange={setMode}>
      {mode === "login" && (
        <LoginForm
          email={email}
          password={password}
          busy={busy}
          message={message}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onForgot={() => setMode("forgot")}
          onSubmit={handleSubmit}
        />
      )}
      {mode === "register" && (
        <RegisterForm
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          strength={passwordStrength}
          busy={busy}
          message={message}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleSubmit}
        />
      )}
      {mode === "forgot" && (
        <ForgotPasswordForm
          email={email}
          busy={busy}
          message={message}
          onEmailChange={setEmail}
          onBack={() => setMode("login")}
          onSubmit={handleSubmit}
        />
      )}
    </AuthPageShell>
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

    const passwordError = validatePasswordChange(
      password,
      confirmPassword,
      session?.user?.email || "",
    );

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

    setMessage("Lozinka je uspješno promijenjena.");

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
          <button type="submit" disabled={busy}>
            {busy ? "Cuvam..." : "Promijeni lozinku"}
          </button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </section>
    </main>
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
  const [activeView, setActiveView] = useState(getDashboardViewFromHash);

  useEffect(() => {
    loadAppData();
  }, []);

  useEffect(() => {
    function syncViewFromHash() {
      setActiveView(getDashboardViewFromHash());
    }

    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  function changeActiveView(nextView) {
    const safeView = DASHBOARD_VIEWS.has(nextView) ? nextView : "overview";
    setActiveView(safeView);
    window.history.replaceState(null, "", `#${safeView}`);
  }

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
          onboarding_completed: false,
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
    const [programResult, yearsResult, semestersResult, subjectsResult] =
      await Promise.all([
        supabase
          .from("study_programs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("academic_years")
          .select("*")
          .order("year_number", { ascending: true }),
        supabase
          .from("semesters")
          .select("*")
          .order("semester_number", { ascending: true }),
        supabase
          .from("subjects")
          .select("*")
          .order("created_at", { ascending: true }),
      ]);

    if (
      programResult.error ||
      yearsResult.error ||
      semestersResult.error ||
      subjectsResult.error
    ) {
      setError(
        getFriendlyAuthError(
          programResult.error ||
            yearsResult.error ||
            semestersResult.error ||
            subjectsResult.error,
        ),
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
    return <main className="center-page">Učitavanje podataka...</main>;
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
      setAcademicYears={setAcademicYears}
      setSemesters={setSemesters}
      setSubjects={setSubjects}
      error={error}
      setError={setError}
      onSignOut={signOut}
      activeView={activeView}
      setActiveView={changeActiveView}
    />
  );
}

function Onboarding({ session, onComplete, onSignOut, initialError }) {
  const [fullName, setFullName] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [programName, setProgramName] = useState("");
  const [studyType, setStudyType] = useState("bachelor_3_year");
  const [startAcademicYear, setStartAcademicYear] = useState(DEFAULT_START_YEAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");

  const selectedStudyType = STUDY_TYPES[studyType];
  const totalEcts = selectedStudyType.programEcts;
  const semesterEctsDefault = selectedStudyType.defaultSemesterEcts;
  const semestersCount = selectedStudyType.semestersCount;
  const totalYears = selectedStudyType.yearsCount;

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
      setError("Odaberi početnu godinu studija.");
      setBusy(false);
      return;
    }

    if (
      !Number.isFinite(Number(semesterEctsDefault)) ||
      Number(semesterEctsDefault) <= 0
    ) {
      setError("ECTS po semestru mora biti veći od 0.");
      setBusy(false);
      return;
    }

    const calculatedSemestersCount = semestersCount;

    if (!Number.isInteger(semestersCount)) {
      setError(
        "Ukupni ECTS mora biti djeljiv sa ECTS vrijednošću po semestru.",
      );
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
        study_type: studyType,
        study_level: selectedStudyType.studyLevel,
        degree_type: selectedStudyType.studyLevel,
        start_academic_year: startAcademicYear,
        total_ects: Number(totalEcts),
        total_semesters: semestersCount,
        semester_ects_default: Number(semesterEctsDefault),
        program_ects: selectedStudyType.programEcts,
        previous_ects: selectedStudyType.previousEcts,
        total_cycle_ects: selectedStudyType.totalCycleEcts,
        years_count: selectedStudyType.yearsCount,
        default_semester_ects: selectedStudyType.defaultSemesterEcts,
      })
      .select()
      .single();

    if (programError) {
      setError(getFriendlyAuthError(programError));
      setBusy(false);
      return;
    }

    const yearsToCreate = Array.from(
      { length: Math.ceil(semestersCount / 2) },
      (_, index) => ({
        user_id: session.user.id,
        program_id: createdProgram.id,
        name: `${index + 1}. godina`,
        year_number: index + 1,
      }),
    );

    const { data: createdYears, error: yearsError } = await supabase
      .from("academic_years")
      .insert(yearsToCreate)
      .select();

    if (yearsError) {
      setError(getFriendlyAuthError(yearsError));
      setBusy(false);
      return;
    }

    const semestersToCreate = Array.from(
      { length: semestersCount },
      (_, index) => {
        const semesterNumber = index + 1;
        const yearNumber = Math.ceil(semesterNumber / 2);
        const academicYear = createdYears.find(
          (year) => year.year_number === yearNumber,
        );

        return {
          user_id: session.user.id,
          program_id: createdProgram.id,
          academic_year_id: academicYear.id,
          academic_year: getStudyYearLabel(academicYear),
          name: `${semesterNumber}. semestar`,
          semester_number: semesterNumber,
          target_ects: Number(semesterEctsDefault),
        };
      },
    );

    const { error: semestersError } = await supabase
      .from("semesters")
      .insert(semestersToCreate);

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
            <p className="muted">
              Iz ovih podataka automatski nastaju godine studija i semestri.
            </p>
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
              placeholder="Ime i Prezime"
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
            Tip studija
            <select
              value={studyType}
              onChange={(event) => setStudyType(event.target.value)}
            >
              {STUDY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">{selectedStudyType.description}</p>

          <label hidden>
            Početna godina studija
            <select
              value={startAcademicYear}
              onChange={(event) => setStartAcademicYear(event.target.value)}
            >
              {ACADEMIC_YEARS.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </label>

          <section className="plan-preview">
            <StatCard label="Broj semestara" value={semestersCount} />
            <StatCard label="Broj godina studija" value={totalYears} />
            <StatCard label="ECTS po semestru" value={semesterEctsDefault} />
            <StatCard
              label="Ukupni ciklus"
              value={`${selectedStudyType.totalCycleEcts} ECTS`}
            />
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
  setAcademicYears,
  setSemesters,
  setSubjects,
  error,
  setError,
  onSignOut,
  activeView,
  setActiveView,
}) {
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(
    academicYears[0]?.id || "",
  );
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || "",
    university_name: program?.university_name || "",
    faculty_name: program?.faculty_name || "",
    program_name: program?.program_name || "",
    study_type: getStudyTypeId(program),
    start_academic_year: program?.start_academic_year || ACADEMIC_YEARS[0],
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    password: "",
    confirmation: "",
  });
  const [deleteAccountMessage, setDeleteAccountMessage] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    ects: "",
    grade: "",
    status: "",
  });
  const [subjectMessage, setSubjectMessage] = useState("");
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectForm, setEditSubjectForm] = useState({
    name: "",
    ects: "",
    grade: "",
    status: "",
  });

  const programStudyType = getStudyTypeId(program);
  const programConfig = STUDY_TYPES[programStudyType];
  const planAlreadyContainsPreviousStudy =
    programConfig.studyLevel === "master" &&
    semesters.some((semester) => Number(semester.semester_number || 0) > 6);
  const plannedSemesters = planAlreadyContainsPreviousStudy
    ? 6 + programConfig.semestersCount
    : programConfig.semestersCount;
  const plannedStudyYears = Math.ceil(plannedSemesters / 2);
  const visibleAcademicYears = academicYears.filter(
    (year) => Number(year.year_number) <= plannedStudyYears,
  );
  const selectedAcademicYear =
    visibleAcademicYears.find((year) => year.id === selectedAcademicYearId) ||
    visibleAcademicYears[0];
  const effectiveSelectedAcademicYearId = selectedAcademicYear?.id || "";
  const visibleSemesters = semesters.filter(
    (semester) => Number(semester.semester_number || 0) <= plannedSemesters,
  );
  const yearSemesters = visibleSemesters.filter(
    (semester) => semester.academic_year_id === effectiveSelectedAcademicYearId,
  );
  const yearSemesterIds = new Set(yearSemesters.map((semester) => semester.id));
  const yearSubjects = subjects.filter((subject) =>
    yearSemesterIds.has(subject.semester_id),
  );
  const visibleSemesterIds = new Set(
    visibleSemesters.map((semester) => semester.id),
  );
  const visibleSubjects = subjects.filter((subject) =>
    visibleSemesterIds.has(subject.semester_id),
  );
  const selectedSemester =
    visibleSemesters.find((semester) => semester.id === selectedSemesterId) ||
    yearSemesters[0];
  const selectedSubjects = subjects.filter(
    (subject) => subject.semester_id === selectedSemester?.id,
  );
  const totalStats = useMemo(
    () => calculateStats(visibleSubjects),
    [visibleSubjects],
  );
  const totalSuccessIndex = useMemo(
    () => calculateSuccessIndex(visibleSubjects),
    [visibleSubjects],
  );
  const carriedSubjects = useMemo(
    () => getCarriedSubjects(visibleSubjects, visibleSemesters),
    [visibleSubjects, visibleSemesters],
  );
  const yearStats = useMemo(() => calculateStats(yearSubjects), [yearSubjects]);
  const yearSuccessIndex = useMemo(
    () => calculateSuccessIndex(yearSubjects),
    [yearSubjects],
  );
  const semesterStats = useMemo(
    () => calculateStats(selectedSubjects),
    [selectedSubjects],
  );
  const programStudyLevel =
    program?.study_level || program?.degree_type || programConfig.studyLevel;
  const programEcts = programConfig.programEcts;
  const totalCycleEcts = programConfig.totalCycleEcts;
  const previousEcts = planAlreadyContainsPreviousStudy
    ? 0
    : programConfig.previousEcts;
  const cycleEarnedEcts = previousEcts + totalStats.earnedEcts;
  const progress = calculateProgress(cycleEarnedEcts, totalCycleEcts);
  const greetingName = profile?.full_name || session.user.email;
  const newPasswordStrength = getPasswordStrength(
    passwordForm.password,
    session.user.email,
    profile?.full_name || "",
  );

  useEffect(() => {
    const currentStillVisible = visibleAcademicYears.some(
      (year) => year.id === selectedAcademicYearId,
    );

    if (!currentStillVisible) {
      setSelectedAcademicYearId(visibleAcademicYears[0]?.id || "");
    }
  }, [visibleAcademicYears, selectedAcademicYearId]);

  useEffect(() => {
    const currentStillVisible = yearSemesters.some(
      (semester) => semester.id === selectedSemesterId,
    );

    if (!currentStillVisible) {
      setSelectedSemesterId(yearSemesters[0]?.id || "");
    }
  }, [selectedAcademicYearId, semesters]);

  function updateProfileStudyType(nextStudyType) {
    setProfileForm({
      ...profileForm,
      study_type: nextStudyType,
    });
  }

  async function expandStudyPlanIfNeeded(nextStudyType) {
    const config = STUDY_TYPES[nextStudyType];
    const currentStudyType = getStudyTypeId(program);
    const addingMasterAfterBachelor =
      currentStudyType === "bachelor_3_year" &&
      config.studyLevel === "master" &&
      semesters.length >= 6;
    const semesterEctsDefault = config.defaultSemesterEcts;
    const targetSemesters = addingMasterAfterBachelor
      ? semesters.length + config.semestersCount
      : Math.max(semesters.length, config.semestersCount);

    if (!Number.isInteger(targetSemesters)) {
      return {
        error: "Ukupni ECTS mora biti djeljiv sa ECTS vrijednošću po semestru.",
      };
    }

    if (targetSemesters < semesters.length) {
      return {
        error:
          "Ne možeš smanjiti ukupan ECTS ispod već kreiranih semestara. Smanjenje plana bi zahtijevalo ručno brisanje podataka.",
      };
    }

    const targetYears = Math.ceil(targetSemesters / 2);
    const existingYearNumbers = new Set(
      academicYears.map((year) => Number(year.year_number)),
    );
    const missingYears = Array.from(
      { length: targetYears },
      (_, index) => index + 1,
    )
      .filter((yearNumber) => !existingYearNumbers.has(yearNumber))
      .map((yearNumber) => ({
        user_id: session.user.id,
        program_id: program.id,
        name: `${yearNumber}. godina`,
        year_number: yearNumber,
      }));

    let createdYears = [];

    if (missingYears.length > 0) {
      const { data, error: yearsError } = await supabase
        .from("academic_years")
        .insert(missingYears)
        .select();

      if (yearsError) {
        return { error: getFriendlyAuthError(yearsError) };
      }

      createdYears = data || [];
    }

    const allYears = [...academicYears, ...createdYears];
    const existingSemesterNumbers = new Set(
      semesters.map((semester) => Number(semester.semester_number)),
    );
    const missingSemesters = Array.from(
      { length: targetSemesters },
      (_, index) => index + 1,
    )
      .filter((semesterNumber) => !existingSemesterNumbers.has(semesterNumber))
      .map((semesterNumber) => {
        const yearNumber = Math.ceil(semesterNumber / 2);
        const studyYear = allYears.find(
          (year) => Number(year.year_number) === yearNumber,
        );

        return {
          user_id: session.user.id,
          program_id: program.id,
          academic_year_id: studyYear.id,
          academic_year: getStudyYearLabel(studyYear),
          name: `${semesterNumber}. semestar`,
          semester_number: semesterNumber,
          target_ects: semesterEctsDefault,
        };
      });

    let createdSemesters = [];

    if (missingSemesters.length > 0) {
      const { data, error: semestersError } = await supabase
        .from("semesters")
        .insert(missingSemesters)
        .select();

      if (semestersError) {
        return { error: getFriendlyAuthError(semestersError) };
      }

      createdSemesters = data || [];
    }

    return {
      targetSemesters,
      createdYears,
      createdSemesters,
      addingMasterAfterBachelor,
    };
  }

  async function updateProfileAndProgram(event) {
    event.preventDefault();
    setError("");
    setProfileMessage("");

    if (profileForm.full_name.trim().length < 2) {
      setError("Ime i prezime mora imati najmanje 2 karaktera.");
      return;
    }

    const selectedConfig = STUDY_TYPES[profileForm.study_type];
    const planExpansion = await expandStudyPlanIfNeeded(profileForm.study_type);

    if (planExpansion.error) {
      setError(planExpansion.error);
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
          study_type: profileForm.study_type,
          study_level: selectedConfig.studyLevel,
          degree_type: selectedConfig.studyLevel,
          total_ects: selectedConfig.programEcts,
          total_semesters: planExpansion.targetSemesters,
          semester_ects_default: selectedConfig.defaultSemesterEcts,
          program_ects: selectedConfig.programEcts,
          previous_ects: planExpansion.addingMasterAfterBachelor
            ? 0
            : selectedConfig.previousEcts,
          total_cycle_ects: selectedConfig.totalCycleEcts,
          years_count: Math.ceil(planExpansion.targetSemesters / 2),
          default_semester_ects: selectedConfig.defaultSemesterEcts,
          start_academic_year: profileForm.start_academic_year,
        })
        .eq("id", program.id)
        .select()
        .single(),
    ]);

    if (profileResult.error || programResult.error) {
      setError(
        getFriendlyAuthError(profileResult.error || programResult.error),
      );
      return;
    }

    setProfile(profileResult.data);
    setProgram(programResult.data);
    if (planExpansion.createdYears.length > 0) {
      setAcademicYears((current) =>
        [...current, ...planExpansion.createdYears].sort(
          (a, b) => Number(a.year_number) - Number(b.year_number),
        ),
      );
    }
    if (planExpansion.createdSemesters.length > 0) {
      setSemesters((current) =>
        [...current, ...planExpansion.createdSemesters].sort(
          (a, b) => Number(a.semester_number) - Number(b.semester_number),
        ),
      );
    }
    setProfileMessage("Profil je sačuvan.");
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
      profile?.full_name || "",
    );

    if (passwordError) {
      setPasswordMessage(passwordError);
      return;
    }

    const { error: currentPasswordError } =
      await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: passwordForm.currentPassword,
      });

    if (currentPasswordError) {
      setPasswordMessage("Trenutna lozinka nije ispravna.");
      logAuthError(currentPasswordError);
      return;
    }

    const { error: passwordErrorResponse } = await supabase.auth.updateUser({
      password: passwordForm.password,
    });

    if (passwordErrorResponse) {
      setPasswordMessage(getFriendlyAuthError(passwordErrorResponse));
      return;
    }

    setPasswordForm({ currentPassword: "", password: "", confirmPassword: "" });
    setPasswordMessage("Lozinka je uspješno promijenjena.");
  }

  function openDeleteAccountModal() {
    setDeleteAccountForm({ password: "", confirmation: "" });
    setDeleteAccountMessage("");
    setDeleteAccountModalOpen(true);
  }

  function closeDeleteAccountModal() {
    if (deleteAccountBusy) {
      return;
    }

    setDeleteAccountModalOpen(false);
    setDeleteAccountForm({ password: "", confirmation: "" });
    setDeleteAccountMessage("");
  }

  async function sendDeleteAccountResetLink() {
    setDeleteAccountMessage("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      session.user.email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (resetError) {
      logAuthError(resetError);
    }

    setDeleteAccountMessage(
      "Ako nalog sa ovom email adresom postoji, poslat je link za resetovanje lozinke.",
    );
  }

  async function deleteAccount(event) {
    event.preventDefault();
    setDeleteAccountMessage("");

    if (
      !deleteAccountForm.password ||
      deleteAccountForm.confirmation !== "OBRIŠI"
    ) {
      return;
    }

    setDeleteAccountBusy(true);

    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: deleteAccountForm.password,
    });

    if (passwordError) {
      logAuthError(passwordError);
      setDeleteAccountBusy(false);
      setDeleteAccountMessage("Lozinka nije ispravna.");
      return;
    }

    const { error: deleteError } = await supabase.functions.invoke(
      "delete-account",
      {
        body: {},
      },
    );

    if (deleteError) {
      logAuthError(deleteError);
      setDeleteAccountBusy(false);
      setDeleteAccountMessage("Došlo je do greške. Pokušajte ponovo.");
      return;
    }

    setProfile(null);
    setProgram(null);
    setAcademicYears([]);
    setSemesters([]);
    setSubjects([]);
    window.localStorage.setItem(
      "accountDeletedMessage",
      "Nalog je uspješno obrisan.",
    );
    await supabase.auth.signOut();
    setDeleteAccountBusy(false);
  }

  async function addSubject(event) {
    event.preventDefault();
    setError("");
    setSubjectMessage("");

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

    setSubjectSaving(true);
    const { data, error: insertError } = await supabase
      .from("subjects")
      .insert({
        user_id: session.user.id,
        semester_id: selectedSemester.id,
        ...values,
      })
      .select()
      .single();
    setSubjectSaving(false);

    if (insertError) {
      setError(getFriendlyAuthError(insertError));
      return;
    }

    setSubjects((current) => [...current, data]);
    setSubjectForm({ name: "", ects: "", grade: "", status: "" });
    setSubjectMessage("Predmet je uspješno dodat.");
  }

  function startEditingSubject(subject) {
    setEditingSubjectId(subject.id);
    setEditSubjectForm({
      name: subject.name,
      ects: String(subject.ects),
      grade: subject.grade ?? "",
      status: subject.status,
    });
  }

  function cancelEditingSubject() {
    setEditingSubjectId(null);
    setEditSubjectForm({ name: "", ects: "", grade: "", status: "" });
  }

  async function updateSubject(subjectId) {
    setError("");
    setSubjectMessage("");

    const values = normalizeSubjectForm(editSubjectForm);
    const validationError = validateSubject(values);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubjectSaving(true);
    const { data, error: updateError } = await supabase
      .from("subjects")
      .update(values)
      .eq("id", subjectId)
      .select()
      .single();
    setSubjectSaving(false);

    if (updateError) {
      setError(getFriendlyAuthError(updateError));
      return;
    }

    setSubjects((current) =>
      current.map((subject) => (subject.id === subjectId ? data : subject)),
    );
    cancelEditingSubject();
    setSubjectMessage("Predmet je uspješno izmijenjen.");
  }

  async function deleteSubject(subjectId) {
    setSubjectMessage("");
    setSubjectSaving(true);
    const { error: deleteError } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectId);
    setSubjectSaving(false);

    if (deleteError) {
      setError(getFriendlyAuthError(deleteError));
      return;
    }

    setSubjects((current) =>
      current.filter((subject) => subject.id !== subjectId),
    );
    setSubjectMessage("Predmet je obrisan.");
  }

  const selectedYear = selectedAcademicYear;
  const selectedStudyYearLabel = selectedYear
    ? getStudyYearLabel(selectedYear)
    : "Godina studija";
  const semesterTargetEcts = Number(
    selectedSemester?.target_ects || program?.semester_ects_default || 0,
  );
  const semesterEnteredEcts = selectedSubjects.reduce(
    (sum, subject) => sum + Number(subject.ects || 0),
    0,
  );
  const semesterEctsDifference = semesterEnteredEcts - semesterTargetEcts;
  const semesterStatus =
    semesterStats.earnedEcts >= semesterTargetEcts ? "Završen" : "Nepotpun";

  const overviewYears = visibleAcademicYears.map((year) => {
    const ids = visibleSemesters
      .filter((semester) => semester.academic_year_id === year.id)
      .map((semester) => semester.id);
    const yearOverviewSubjects = subjects.filter((subject) =>
      ids.includes(subject.semester_id),
    );
    const stats = calculateStats(yearOverviewSubjects);
    const successIndex = calculateSuccessIndex(yearOverviewSubjects);

    return {
      year,
      stats,
      successIndex,
      semesterCount: ids.length,
    };
  });

  if (activeView === "overview") {
    return (
      <MainLayout
        activeView={activeView}
        onViewChange={setActiveView}
        onSignOut={onSignOut}
        userEmail={session.user.email}
      >
        {error && <p className="alert">{error}</p>}

        <section className="panel overview-hero">
          <div>
            <p className="eyebrow">Pregled prosjeka</p>
            <h2>Dobrodošao, {greetingName}</h2>
            <p className="muted">
              Ovo je kratki pregled tvog studijskog napretka. Detalje semestara
              i predmete uređuješ u sekciji Moje studije.
            </p>
          </div>
          <button type="button" onClick={() => setActiveView("studies")}>
            Otvori Moje studije
          </button>
        </section>

        <section className="summary-grid">
          <StatCard
            label="Ukupni prosjek"
            value={totalStats.average ? totalStats.average.toFixed(2) : "-"}
          />
          <StatCard
            label="Osvojeno ECTS / ukupno ECTS"
            value={`${formatNumber(cycleEarnedEcts)} / ${formatNumber(totalCycleEcts)}`}
          />
          <StatCard label="Napredak" value={`${progress.toFixed(0)}%`} />
          <StatCard label="Godine studija" value={plannedStudyYears} />
          <StatCard label="Semestri" value={plannedSemesters} />
          <StatCard
            label="Indeks uspješnosti"
            value={
              totalSuccessIndex === null
                ? "Nema podataka"
                : totalSuccessIndex.toFixed(2)
            }
            note="Orijentacioni indeks za dom, stipendije i studentske kredite. Nepoložen predmet ne dodaje ocjenu u zbir, ali njegovi ECTS ulaze u obračun."
          />
          <StatCard
            label="Nepoloženo ECTS"
            value={formatNumber(totalStats.failedEcts)}
          />
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Napredak</p>
              <h2>Procenat završenih studija</h2>
            </div>
            <strong>{progress.toFixed(0)}%</strong>
          </div>
          <div className="progress-bar">
            <span style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Godine studija</p>
              <h2>Kratak sažetak</h2>
            </div>
          </div>

          {overviewYears.length === 0 ? (
            <p className="empty">Još nema godina studija ili semestara.</p>
          ) : (
            <div className="overview-year-list">
              {overviewYears.map(
                ({ year, stats, successIndex, semesterCount }) => (
                  <article className="overview-year-card" key={year.id}>
                    <div>
                      <strong>{getStudyYearLabel(year)}</strong>
                      <span>{semesterCount} semestara</span>
                    </div>
                    <small>
                      Prosjek {stats.average ? stats.average.toFixed(2) : "-"} ·{" "}
                      {formatNumber(stats.earnedEcts)} ECTS
                    </small>
                    <small>
                      Indeks uspješnosti{" "}
                      {successIndex === null
                        ? "Nema podataka"
                        : successIndex.toFixed(2)}{" "}
                      · Nepoloženo {formatNumber(stats.failedEcts)} ECTS
                    </small>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <CarriedSubjectsCard
          carriedSubjects={carriedSubjects}
          subjects={visibleSubjects}
        />
      </MainLayout>
    );
  }

  if (activeView === "profile") {
    return (
      <MainLayout
        activeView={activeView}
        onViewChange={setActiveView}
        onSignOut={onSignOut}
        userEmail={session.user.email}
      >
        {error && <p className="alert">{error}</p>}

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Profil</p>
              <h2>Lični podaci i studijski program</h2>
            </div>
          </div>
          <p className="muted profile-email">Email: {session.user.email}</p>

          <form
            className="stack-form profile-form"
            onSubmit={updateProfileAndProgram}
          >
            <label>
              Ime i prezime
              <input
                value={profileForm.full_name}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    full_name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Univerzitet
              <input
                value={profileForm.university_name}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    university_name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Fakultet
              <input
                value={profileForm.faculty_name}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    faculty_name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Studijski program
              <input
                value={profileForm.program_name}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    program_name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Tip studija
              <select
                value={profileForm.study_type}
                onChange={(event) => updateProfileStudyType(event.target.value)}
              >
                {STUDY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label hidden>
              Početna godina studija
              <select
                value={profileForm.start_academic_year}
                onChange={(event) =>
                  setProfileForm({
                    ...profileForm,
                    start_academic_year: event.target.value,
                  })
                }
              >
                {ACADEMIC_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Sačuvaj profil</button>
            {profileMessage && (
              <p className="form-message success">{profileMessage}</p>
            )}
          </form>
        </section>

        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">Sigurnost</p>
              <h2>Promijeni lozinku</h2>
            </div>
          </div>
          <form className="stack-form profile-form" onSubmit={changePassword}>
            <label>
              Trenutna lozinka
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Nova lozinka
              <input
                type="password"
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm({
                    ...passwordForm,
                    password: event.target.value,
                  })
                }
              />
            </label>
            <PasswordStrengthMeter strength={newPasswordStrength} />
            <label>
              Potvrdi novu lozinku
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: event.target.value,
                  })
                }
              />
            </label>
            <button type="submit">Promijeni lozinku</button>
            {passwordMessage && (
              <p className="form-message success">{passwordMessage}</p>
            )}
          </form>
        </section>

        <section className="panel danger-zone">
          <div className="section-title">
            <div>
              <p className="eyebrow">Opasna zona</p>
              <h2>Brisanje naloga</h2>
            </div>
          </div>
          <p className="muted">
            Ova akcija trajno briše nalog i sve podatke povezane sa njim.
            Brisanje nije moguće poništiti.
          </p>
          <button
            className="danger-button"
            type="button"
            onClick={openDeleteAccountModal}
          >
            Obriši nalog
          </button>
        </section>

        {deleteAccountModalOpen && (
          <div
            className="modal-layer"
            role="presentation"
            onMouseDown={closeDeleteAccountModal}
          >
            <section
              className="modal-card delete-account-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="section-title">
                <div>
                  <p className="eyebrow">Trajno brisanje</p>
                  <h2 id="delete-account-title">Obriši nalog</h2>
                </div>
              </div>
              <p className="alert">
                Trajno će se obrisati nalog, profil, studijski program,
                akademske godine, semestri i predmeti.
              </p>
              <form className="stack-form" onSubmit={deleteAccount}>
                <label>
                  Trenutna lozinka
                  <input
                    type="password"
                    value={deleteAccountForm.password}
                    onChange={(event) =>
                      setDeleteAccountForm({
                        ...deleteAccountForm,
                        password: event.target.value,
                      })
                    }
                    autoFocus
                  />
                </label>
                <button
                  className="link-button"
                  type="button"
                  onClick={sendDeleteAccountResetLink}
                >
                  Zaboravili ste lozinku?
                </button>
                <label>
                  Upišite OBRIŠI za potvrdu
                  <input
                    value={deleteAccountForm.confirmation}
                    onChange={(event) =>
                      setDeleteAccountForm({
                        ...deleteAccountForm,
                        confirmation: event.target.value,
                      })
                    }
                  />
                </label>
                {deleteAccountMessage && (
                  <p className="form-message">{deleteAccountMessage}</p>
                )}
                <div className="modal-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={closeDeleteAccountModal}
                    disabled={deleteAccountBusy}
                  >
                    Odustani
                  </button>
                  <button
                    className="danger-button"
                    type="submit"
                    disabled={
                      deleteAccountBusy ||
                      !deleteAccountForm.password ||
                      deleteAccountForm.confirmation !== "OBRIŠI"
                    }
                  >
                    {deleteAccountBusy ? "Brisanje..." : "Trajno obriši nalog"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </MainLayout>
    );
  }

  return (
    <MainLayout
      activeView={activeView}
      onViewChange={setActiveView}
      onSignOut={onSignOut}
      userEmail={session.user.email}
    >
      {error && <p className="alert">{error}</p>}

      {program && (
        <section className="program-card">
          <div>
            <p className="eyebrow">Studijski program</p>
            <h2>{program.program_name || DEGREE_LABELS[programStudyLevel]}</h2>
            <div className="program-details">
              <span>
                {program.university_name || "Univerzitet nije unesen"}
              </span>
              <span>{program.faculty_name || "Fakultet nije unesen"}</span>
              <span>
                {programConfig.label ||
                  DEGREE_LABELS[programStudyLevel] ||
                  programStudyLevel}
              </span>
              <span>Početak studija {program.start_academic_year}</span>
              <span>{programEcts} ECTS program</span>
              <span>{totalCycleEcts} ECTS ukupni ciklus</span>
              <span>{plannedSemesters} semestara</span>
            </div>
          </div>
          <GraduationCap size={34} />
        </section>
      )}

      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Moje studije</p>
            <h2>Godine studija</h2>
          </div>
          <strong>
            Prosjek godine studija:{" "}
            {yearStats.average ? yearStats.average.toFixed(2) : "-"}
          </strong>
        </div>

        {visibleAcademicYears.length === 0 ? (
          <p className="empty">Još nema godina studija ili semestara.</p>
        ) : (
          <>
            <div className="year-tabs">
              {visibleAcademicYears.map((year) => (
                <button
                  className={selectedAcademicYearId === year.id ? "active" : ""}
                  key={year.id}
                  type="button"
                  onClick={() => setSelectedAcademicYearId(year.id)}
                >
                  {getStudyYearLabel(year)}
                </button>
              ))}
            </div>

            <div className="summary-grid compact">
              <StatCard
                label="Osvojeno ECTS"
                value={formatNumber(yearStats.earnedEcts)}
              />
              <StatCard
                label="Ukupno prijavljeno ECTS"
                value={formatNumber(yearStats.attemptedEcts)}
              />
              <StatCard
                label="Indeks uspješnosti"
                value={
                  yearSuccessIndex === null
                    ? "Nema podataka"
                    : yearSuccessIndex.toFixed(2)
                }
              />
              <StatCard
                label="Nepoloženo ECTS"
                value={formatNumber(yearStats.failedEcts)}
              />
            </div>

            {yearSemesters.length === 0 ? (
              <p className="empty">U ovoj godini studija još nema semestara.</p>
            ) : (
              <div className="semester-grid">
                {yearSemesters.map((semester) => {
                  const semesterSubjects = subjects.filter(
                    (subject) => subject.semester_id === semester.id,
                  );
                  const stats = calculateStats(semesterSubjects);
                  const target = Number(semester.target_ects || 0);
                  const status =
                    stats.earnedEcts >= target ? "Završen" : "Nepotpun";

                  return (
                    <button
                      className={`semester-card ${selectedSemester?.id === semester.id ? "active" : ""}`}
                      key={semester.id}
                      onClick={() => setSelectedSemesterId(semester.id)}
                      type="button"
                    >
                      <span>Status: {status}</span>
                      <strong>{semester.name}</strong>
                      <small>
                        Prosjek {stats.average ? stats.average.toFixed(2) : "-"}
                      </small>
                      <small>
                        {formatNumber(stats.earnedEcts)} /{" "}
                        {formatNumber(target)} ECTS · Nepoloženo{" "}
                        {formatNumber(stats.failedEcts)} ECTS
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {selectedSemester ? (
        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">{selectedStudyYearLabel}</p>
              <h2>{selectedSemester.name}</h2>
            </div>
            <strong>Status: {semesterStatus}</strong>
          </div>

          <section className="summary-grid compact">
            <StatCard
              label="Prosjek"
              value={
                semesterStats.average ? semesterStats.average.toFixed(2) : "-"
              }
            />
            <StatCard
              label="Osvojeno ECTS / ciljni ECTS"
              value={`${formatNumber(semesterStats.earnedEcts)} / ${formatNumber(semesterTargetEcts)}`}
            />
            <StatCard
              label="Nepoloženo ECTS"
              value={formatNumber(semesterStats.failedEcts)}
            />
            <StatCard
              label="Ukupno prijavljeno ECTS"
              value={formatNumber(semesterStats.attemptedEcts)}
            />
          </section>

          {semesterEctsDifference !== 0 && semesterTargetEcts > 0 && (
            <p className="form-message warning">
              {semesterEctsDifference < 0
                ? `Uneseno: ${formatNumber(semesterEnteredEcts)} / ${formatNumber(
                    semesterTargetEcts,
                  )} ECTS. Nedostaje: ${formatNumber(Math.abs(semesterEctsDifference))} ECTS.`
                : `Uneseno: ${formatNumber(semesterEnteredEcts)} / ${formatNumber(
                    semesterTargetEcts,
                  )} ECTS. Prekoračenje: ${formatNumber(semesterEctsDifference)} ECTS.`}
            </p>
          )}

          <SubjectForm
            subjectForm={subjectForm}
            onChange={setSubjectForm}
            onSubmit={addSubject}
            saving={subjectSaving}
          />

          {subjectMessage && (
            <p className="form-message success">{subjectMessage}</p>
          )}

          <SubjectTable
            subjects={selectedSubjects}
            editingSubjectId={editingSubjectId}
            editSubjectForm={editSubjectForm}
            setEditSubjectForm={setEditSubjectForm}
            onEdit={startEditingSubject}
            onUpdate={updateSubject}
            onCancel={cancelEditingSubject}
            onDelete={deleteSubject}
            saving={subjectSaving}
          />

          <SubjectLists stats={semesterStats} />
        </section>
      ) : (
        <section className="panel">
          <p className="empty">Odaberi semestar da vidiš predmete i detalje.</p>
        </section>
      )}
    </MainLayout>
  );

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
              <span>
                {program.university_name || "Univerzitet nije unesen"}
              </span>
              <span>{program.faculty_name || "Fakultet nije unesen"}</span>
              <span>
                {programConfig.label ||
                  DEGREE_LABELS[programStudyLevel] ||
                  programStudyLevel}
              </span>
              <span>Početak studija {program.start_academic_year}</span>
              <span>{programEcts} ECTS program</span>
              <span>{totalCycleEcts} ECTS ukupni ciklus</span>
              <span>{plannedSemesters} semestara</span>
            </div>
          </div>
          <GraduationCap size={34} />
        </section>
      )}

      <section className="summary-grid">
        <StatCard
          label="Ukupni prosjek studija"
          value={totalStats.average ? totalStats.average.toFixed(2) : "-"}
        />
        <StatCard
          label="Ukupno osvojeno ECTS"
          value={formatNumber(totalStats.earnedEcts)}
        />
        <StatCard
          label="Ukupni ciklus ECTS"
          value={formatNumber(totalCycleEcts)}
        />
        <StatCard
          label="Nepoloženo ECTS"
          value={formatNumber(totalStats.failedEcts)}
        />
        <StatCard
          label="Procenat zavrsenih studija"
          value={`${progress.toFixed(0)}%`}
        />
      </section>

      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Profil i studijski program</h2>
            <p>Tekstualne podatke možeš mijenjati bez rekreiranja semestara.</p>
          </div>
        </div>
        <form className="settings-form" onSubmit={updateProfileAndProgram}>
          <label>
            Ime i prezime
            <input
              value={profileForm.full_name}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  full_name: event.target.value,
                })
              }
            />
          </label>
          <label>
            Univerzitet
            <input
              value={profileForm.university_name}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  university_name: event.target.value,
                })
              }
            />
          </label>
          <label>
            Fakultet
            <input
              value={profileForm.faculty_name}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  faculty_name: event.target.value,
                })
              }
            />
          </label>
          <label>
            Studijski program
            <input
              value={profileForm.program_name}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  program_name: event.target.value,
                })
              }
            />
          </label>
          <label>
            Tip studija
            <select
              value={profileForm.study_type}
              onChange={(event) => updateProfileStudyType(event.target.value)}
            >
              {STUDY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label hidden>
            Početna godina studija
            <select
              value={profileForm.start_academic_year}
              onChange={(event) =>
                setProfileForm({
                  ...profileForm,
                  start_academic_year: event.target.value,
                })
              }
            >
              {ACADEMIC_YEARS.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Sačuvaj profil</button>
        </form>
        <p className="warning-note">
          Ukupni ECTS se ne mijenja ovdje jer promjena može uticati na strukturu
          već kreiranih semestara i predmeta.
        </p>
        {profileMessage && <p className="success-message">{profileMessage}</p>}

        <div className="divider" />

        <div className="section-title">
          <div>
            <h2>Promijeni lozinku</h2>
            <p>Koristi najmanje 8 karaktera; preporuceno je 12 ili vise.</p>
          </div>
        </div>
        <form
          className="settings-form password-settings"
          onSubmit={changePassword}
        >
          <label>
            Trenutna lozinka
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  currentPassword: event.target.value,
                })
              }
              required
            />
          </label>
          <label>
            Nova lozinka
            <input
              type="password"
              value={passwordForm.password}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  password: event.target.value,
                })
              }
              minLength="8"
            />
          </label>
          <label>
            Potvrdi novu lozinku
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  confirmPassword: event.target.value,
                })
              }
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
            <p>
              {formatNumber(cycleEarnedEcts)} od {formatNumber(totalCycleEcts)}{" "}
              ECTS
            </p>
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
            <h2>Godine studija</h2>
            <p>Semestri su automatski kreirani iz studijskog plana.</p>
          </div>
        </div>

        <div className="year-tabs">
          {academicYears.map((academicYear) => (
            <button
              className={
                academicYear.id === selectedAcademicYearId ? "active" : ""
              }
              key={academicYear.id}
              type="button"
              onClick={() => setSelectedAcademicYearId(academicYear.id)}
            >
              {getStudyYearLabel(academicYear)}
            </button>
          ))}
        </div>

        <section className="summary-grid compact">
          <StatCard
            label="Prosjek godine"
            value={yearStats.average ? yearStats.average.toFixed(2) : "-"}
          />
          <StatCard
            label="Osvojeno ECTS u godini"
            value={formatNumber(yearStats.earnedEcts)}
          />
          <StatCard
            label="Nepoloženo ECTS u godini"
            value={formatNumber(yearStats.failedEcts)}
          />
        </section>

        <div className="semester-grid">
          {yearSemesters.map((semester) => {
            const semesterSubjects = subjects.filter(
              (subject) => subject.semester_id === semester.id,
            );
            const stats = calculateStats(semesterSubjects);
            const targetEcts = Number(semester.target_ects);
            const semesterStatus =
              stats.earnedEcts >= targetEcts ? "Završen" : "Nepotpun";

            return (
              <button
                className={`semester-card ${semester.id === selectedSemester?.id ? "active" : ""}`}
                key={semester.id}
                onClick={() => setSelectedSemesterId(semester.id)}
                type="button"
              >
                <strong>{semester.name}</strong>
                <div className="semester-card-metrics">
                  <span>
                    Prosjek {stats.average ? stats.average.toFixed(2) : "-"}
                  </span>
                  <span>
                    Osvojeno {formatNumber(stats.earnedEcts)} /{" "}
                    {formatNumber(targetEcts)} ECTS
                  </span>
                  <span>Nepoloženo {formatNumber(stats.failedEcts)} ECTS</span>
                </div>
                <span
                  className={`semester-status ${semesterStatus === "Završen" ? "complete" : "incomplete"}`}
                >
                  {semesterStatus}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSemester && (
        <section className="panel">
          {(() => {
            const targetEcts = Number(selectedSemester.target_ects);
            const ectsDifference = semesterStats.attemptedEcts - targetEcts;

            if (ectsDifference === 0) {
              return null;
            }

            return (
              <p className="warning-note">
                Uneseno: {formatNumber(semesterStats.attemptedEcts)} /{" "}
                {formatNumber(targetEcts)} ECTS.{" "}
                {ectsDifference < 0
                  ? `Nedostaje: ${formatNumber(Math.abs(ectsDifference))} ECTS.`
                  : `Prekoračenje: ${formatNumber(ectsDifference)} ECTS.`}
              </p>
            );
          })()}
          <div className="section-title">
            <div>
              <h2>{selectedSemester.name}</h2>
              <p>
                {getStudyYearLabel(
                  academicYears.find(
                    (year) => year.id === selectedSemester.academic_year_id,
                  ),
                )}{" "}
                · cilj {formatNumber(Number(selectedSemester.target_ects))} ECTS
              </p>
            </div>
            <div className="semester-average">
              Prosjek{" "}
              {semesterStats.average ? semesterStats.average.toFixed(2) : "-"}
            </div>
          </div>

          <section className="summary-grid compact">
            <StatCard
              label="Osvojeno ECTS"
              value={formatNumber(semesterStats.earnedEcts)}
            />
            <StatCard
              label="Prijavljeno ECTS"
              value={formatNumber(semesterStats.attemptedEcts)}
            />
            <StatCard
              label="Nepoloženo ECTS"
              value={formatNumber(semesterStats.failedEcts)}
            />
          </section>

          <SubjectForm
            subjectForm={subjectForm}
            saving={subjectSaving}
            onChange={setSubjectForm}
            onSubmit={addSubject}
          />

          <SubjectTable
            subjects={selectedSubjects}
            editingSubjectId={editingSubjectId}
            editSubjectForm={editSubjectForm}
            setEditSubjectForm={setEditSubjectForm}
            onEdit={startEditingSubject}
            onUpdate={updateSubject}
            onCancel={cancelEditingSubject}
            onDelete={deleteSubject}
            saving={subjectSaving}
          />
          {subjectMessage && (
            <p className="success-message">{subjectMessage}</p>
          )}
          <SubjectLists stats={semesterStats} />
        </section>
      )}
    </main>
  );
}

function StatCard({ label, value, note }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function SubjectLists({ stats }) {
  return (
    <div className="lists-grid">
      <SubjectList
        icon={<CheckCircle2 size={18} />}
        title="Položeni predmeti"
        subjects={stats.passedSubjects}
      />
      <SubjectList
        icon={<XCircle size={18} />}
        title="Nepoloženi predmeti"
        subjects={stats.failedSubjects}
      />
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
