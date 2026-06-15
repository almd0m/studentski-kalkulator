export const ACADEMIC_YEARS = Array.from({ length: new Date().getFullYear() - 2010 + 1 }, (_, index) => {
  const startYear = 2010 + index;
  return `${startYear}/${startYear + 1}`;
}).reverse();

export const ECTS_OPTIONS = {
  bachelor: [180, 240],
  master: [60, 120]
};

export const DEGREE_LABELS = {
  bachelor: "Osnovne studije",
  master: "Master"
};

export const SUBJECT_STATUSES = {
  passed: "Položen",
  failed: "Pao"
};

export function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function getAcademicYearName(startAcademicYear, yearIndex) {
  const startYear = Number(startAcademicYear.slice(0, 4)) + yearIndex;
  return `${startYear}/${startYear + 1}`;
}
