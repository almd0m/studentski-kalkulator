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

function calculateStats(subjects) {
  const passedSubjects = subjects.filter((subject) => subject.status === "passed");
  const failedSubjects = subjects.filter((subject) => subject.status === "failed");
  const plannedSubjects = subjects.filter((subject) => subject.status === "planned");
  const attemptedEcts = subjects.reduce((sum, subject) => sum + Number(subject.ects), 0);
  const earnedEcts = passedSubjects.reduce((sum, subject) => sum + Number(subject.ects), 0);
  const failedEcts = failedSubjects.reduce((sum, subject) => sum + Number(subject.ects), 0);
  const weightedSum = passedSubjects.reduce(
    (sum, subject) => sum + Number(subject.grade) * Number(subject.ects),
    0
  );

  return {
    average: earnedEcts > 0 ? weightedSum / earnedEcts : 0,
    attemptedEcts,
    earnedEcts,
    failedEcts,
    passedSubjects,
    failedSubjects,
    plannedSubjects
  };
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    const authCall =
      mode === "login"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await authCall;
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (mode === "register") {
      setMessage("Nalog je kreiran. Ako je potvrda emaila ukljucena, provjeri inbox prije prijave.");
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
          <label>
            Lozinka
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength="6"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Sacekaj..." : mode === "login" ? "Prijavi se" : "Registruj se"}
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
      setError(profileResult.error.message);
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
          onboarding_completed: false
        })
        .select()
        .single();

      if (insertError) {
        setError(insertError.message);
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
        programResult.error?.message ||
          yearsResult.error?.message ||
          semestersResult.error?.message ||
          subjectsResult.error?.message
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
      academicYears={academicYears}
      semesters={semesters}
      subjects={subjects}
      setSubjects={setSubjects}
      error={error}
      setError={setError}
      onSignOut={signOut}
    />
  );
}

function Onboarding({ session, onComplete, onSignOut, initialError }) {
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
      setError(programError.message);
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
      setError(yearsError.message);
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
      setError(semestersError.message);
      setBusy(false);
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", session.user.id)
      .select()
      .single();

    if (profileError) {
      setError(profileError.message);
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
  academicYears,
  semesters,
  subjects,
  setSubjects,
  error,
  setError,
  onSignOut
}) {
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState(academicYears[0]?.id || "");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [subjectForm, setSubjectForm] = useState({
    name: "",
    ects: "",
    grade: "",
    status: "passed"
  });

  const yearSemesters = semesters.filter((semester) => semester.academic_year_id === selectedAcademicYearId);
  const selectedSemester = semesters.find((semester) => semester.id === selectedSemesterId) || yearSemesters[0];
  const selectedSubjects = subjects.filter((subject) => subject.semester_id === selectedSemester?.id);
  const totalStats = useMemo(() => calculateStats(subjects), [subjects]);
  const semesterStats = useMemo(() => calculateStats(selectedSubjects), [selectedSubjects]);
  const programStudyLevel = program?.study_level || program?.degree_type;

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

  async function addSubject(event) {
    event.preventDefault();
    setError("");

    const name = subjectForm.name.trim();
    const ects = Number(subjectForm.ects);
    const grade = subjectForm.grade === "" ? null : Number(subjectForm.grade);

    if (!selectedSemester?.id) {
      setError("Prvo odaberi semestar.");
      return;
    }

    if (!name) {
      setError("Naziv predmeta ne smije biti prazan.");
      return;
    }

    if (!Number.isFinite(ects) || ects <= 0) {
      setError("ECTS mora biti veci od 0.");
      return;
    }

    if (subjectForm.status === "passed" && (!Number.isInteger(grade) || grade < 6 || grade > 10)) {
      setError("Za polozen predmet ocjena mora biti od 6 do 10.");
      return;
    }

    if (subjectForm.status === "failed" && grade !== null && grade !== 5) {
      setError("Za nepolozen predmet ocjena moze biti 5 ili prazna.");
      return;
    }

    if (subjectForm.status === "planned" && grade !== null) {
      setError("Planirani predmet ne moze imati ocjenu.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("subjects")
      .insert({
        user_id: session.user.id,
        semester_id: selectedSemester.id,
        name,
        ects,
        grade,
        status: subjectForm.status
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubjects((current) => [...current, data]);
    setSubjectForm({ name: "", ects: "", grade: "", status: "passed" });
  }

  async function deleteSubject(subjectId) {
    const { error: deleteError } = await supabase.from("subjects").delete().eq("id", subjectId);

    if (deleteError) {
      setError(deleteError.message);
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Moj Prosjek</p>
          <h1>Dashboard</h1>
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
        <StatCard label="Ukupni prosjek" value={totalStats.average ? totalStats.average.toFixed(2) : "-"} />
        <StatCard label="Osvojeno ECTS" value={formatNumber(totalStats.earnedEcts)} />
        <StatCard label="Prijavljeno ECTS" value={formatNumber(totalStats.attemptedEcts)} />
        <StatCard label="Nepolozeno ECTS" value={formatNumber(totalStats.failedEcts)} />
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

          <SubjectTable subjects={selectedSubjects} onDelete={deleteSubject} />
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

function SubjectTable({ subjects, onDelete }) {
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
              <td>{subject.name}</td>
              <td>{formatNumber(Number(subject.ects))}</td>
              <td>{subject.grade ?? "-"}</td>
              <td>
                <span className={`status ${subject.status}`}>{SUBJECT_STATUSES[subject.status]}</span>
              </td>
              <td>
                <button className="icon-button" type="button" onClick={() => onDelete(subject.id)} aria-label="Obrisi predmet">
                  <Trash2 size={17} />
                </button>
              </td>
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
