export default function SemesterCard({ semester, active, stats, onClick, formatNumber }) {
  return (
    <button className={`semester-card ${active ? "active" : ""}`} onClick={onClick} type="button">
      <span>{semester.target_ects} ciljnih ECTS</span>
      <strong>{semester.name}</strong>
      <small>
        Prosjek {stats.average ? stats.average.toFixed(2) : "-"} · {formatNumber(stats.earnedEcts)} ECTS
      </small>
    </button>
  );
}
