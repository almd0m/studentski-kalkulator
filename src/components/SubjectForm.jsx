import { Plus } from "lucide-react";
import { SUBJECT_STATUSES } from "../utils/formatting";
import { applySubjectGrade } from "../utils/validation";

export default function SubjectForm({ subjectForm, saving, onChange, onSubmit }) {
  const statusLabel = SUBJECT_STATUSES[subjectForm.status] || "Nedovršen unos";

  return (
    <form className="subject-form" onSubmit={onSubmit}>
      <label>
        Predmet
        <input
          value={subjectForm.name}
          onChange={(event) => onChange({ ...subjectForm, name: event.target.value })}
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
          onChange={(event) => onChange({ ...subjectForm, ects: event.target.value })}
          placeholder="6"
        />
      </label>
      <label>
        Ocjena
        <input
          type="number"
          min="5"
          max="10"
          value={subjectForm.grade}
          onChange={(event) => onChange(applySubjectGrade(subjectForm, event.target.value))}
          placeholder="5-10"
        />
      </label>
      <label>
        Status
        <span className={`status readonly ${subjectForm.status || "incomplete"}`}>{statusLabel}</span>
      </label>
      <button type="submit" disabled={saving}>
        <Plus size={18} />
        {saving ? "Spremanje..." : "Dodaj predmet"}
      </button>
    </form>
  );
}
