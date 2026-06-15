import { formatNumber } from "../utils/formatting";

function formatDestinationSemester(label) {
  return label.replace(/semestar$/i, "semestru");
}

export default function CarriedSubjectsCard({ carriedSubjects, subjects }) {
  const totalEcts = carriedSubjects.reduce((sum, subject) => sum + subject.ects, 0);
  const hasSubjects = subjects.length > 0;
  const hasIncompleteSubjects = subjects.some((subject) => subject.grade === null);

  return (
    <section className="panel carried-subjects-card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Preneseni predmeti</p>
          <h2>Predmeti koje prenosiš</h2>
        </div>
      </div>

      {!hasSubjects ? (
        <p className="empty">Još nema unesenih predmeta.</p>
      ) : carriedSubjects.length === 0 ? (
        <p className="empty">Čestitke! Svi evidentirani predmeti su položeni u roku.</p>
      ) : (
        <>
          <p className="muted">
            Ukupno: {carriedSubjects.length} {carriedSubjects.length === 1 ? "predmet" : "predmeta"} •{" "}
            {formatNumber(totalEcts)} ECTS
          </p>
          <div className="carried-subject-list">
            {carriedSubjects.map((subject) => (
              <article className="carried-subject-item" key={subject.id}>
                <div>
                  <strong>{subject.name}</strong>
                  <span>Iz: {subject.originalSemesterLabel}</span>
                  <span>
                    {subject.hasDestinationSemester
                      ? `Ponovo polažeš u: ${formatDestinationSemester(subject.destinationSemesterLabel)}`
                      : "Zaostala obaveza do završetka studija"}
                  </span>
                </div>
                <b>ECTS: {formatNumber(subject.ects)}</b>
              </article>
            ))}
          </div>
        </>
      )}

      {hasIncompleteSubjects && (
        <p className="small-note">Nedovršeni unosi neće biti prikazani kao preneseni dok ne unesete ocjenu.</p>
      )}
      <p className="small-note">
        Prikaz je orijentacioni. Tačan način ponovnog polaganja može zavisiti od pravila fakulteta.
      </p>
    </section>
  );
}
