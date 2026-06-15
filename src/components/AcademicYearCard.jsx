export default function AcademicYearCard({ academicYear, active, onClick }) {
  const label = academicYear?.year_number ? `${academicYear.year_number}. godina` : academicYear.name;

  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {label}
    </button>
  );
}
