import { Trash2 } from "lucide-react";
import { SUBJECT_STATUSES, formatNumber } from "../utils/formatting";
import { applySubjectGrade } from "../utils/validation";

function getSubjectStatusLabel(status) {
  return SUBJECT_STATUSES[status] || "Nedovršen unos";
}

export default function SubjectTable({
  subjects,
  editingSubjectId,
  editSubjectForm,
  setEditSubjectForm,
  onEdit,
  onUpdate,
  onCancel,
  onDelete,
  saving
}) {
  if (subjects.length === 0) {
    return <p className="empty">Još nema predmeta u ovom semestru. Dodajte prvi predmet da biste izračunali prosjek.</p>;
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
                      min="5"
                      max="10"
                      value={editSubjectForm.grade}
                      onChange={(event) => setEditSubjectForm(applySubjectGrade(editSubjectForm, event.target.value))}
                    />
                  </td>
                  <td>
                    <span className={`status readonly ${editSubjectForm.status || "incomplete"}`}>
                      {getSubjectStatusLabel(editSubjectForm.status)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => onUpdate(subject.id)} disabled={saving}>
                        {saving ? "Spremanje..." : "Sačuvaj"}
                      </button>
                      <button className="ghost-button" type="button" onClick={onCancel}>
                        Otkaži
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td>{subject.name}</td>
                  <td>{formatNumber(Number(subject.ects))}</td>
                  <td>{subject.grade ?? "-"}</td>
                  <td>
                    <span className={`status ${subject.status || "incomplete"}`}>
                      {getSubjectStatusLabel(subject.status)}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost-button" type="button" onClick={() => onEdit(subject)}>
                        Uredi
                      </button>
                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => onDelete(subject.id)}
                        aria-label="Obriši predmet"
                        disabled={saving}
                      >
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
