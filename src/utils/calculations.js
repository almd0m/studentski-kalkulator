export function calculateStats(subjects) {
  const passedSubjects = subjects.filter(
    (subject) => subject.status === "passed",
  );
  const failedSubjects = subjects.filter(
    (subject) => subject.status === "failed",
  );
  const attemptedSubjects = subjects.filter(
    (subject) => subject.status === "passed" || subject.status === "failed",
  );
  const attemptedEcts = attemptedSubjects.reduce(
    (sum, subject) => sum + Number(subject.ects),
    0,
  );
  const earnedEcts = passedSubjects.reduce(
    (sum, subject) => sum + Number(subject.ects),
    0,
  );
  const failedEcts = failedSubjects.reduce(
    (sum, subject) => sum + Number(subject.ects),
    0,
  );
  const averageDenominator = earnedEcts;
  const weightedSum = passedSubjects.reduce(
    (sum, subject) => sum + Number(subject.grade) * Number(subject.ects),
    0,
  );

  return {
    average: averageDenominator > 0 ? weightedSum / averageDenominator : 0,
    weightedSum,
    attemptedEcts,
    earnedEcts,
    failedEcts,
    passedSubjects,
    failedSubjects,
  };
}

export function calculateProgress(earnedEcts, totalEcts) {
  if (!totalEcts) {
    return 0;
  }

  return Math.min(100, (earnedEcts / Number(totalEcts)) * 100);
}

export function calculateSuccessIndex(subjects) {
  const relevantSubjects = subjects.filter(
    (subject) => subject.status === "passed" || subject.status === "failed",
  );
  const denominator = relevantSubjects.reduce(
    (sum, subject) => sum + Number(subject.ects),
    0,
  );

  if (denominator === 0) {
    return null;
  }

  const numerator = relevantSubjects.reduce((sum, subject) => {
    if (subject.status !== "passed") {
      return sum;
    }

    return sum + Number(subject.grade) * Number(subject.ects);
  }, 0);

  return numerator / denominator;
}

export function getCarriedSubjects(subjects, semesters) {
  return subjects
    .filter(
      (subject) => subject.status === "failed" || Number(subject.grade) === 5,
    )
    .map((subject) => {
      const originalSemester = semesters.find(
        (semester) => semester.id === subject.semester_id,
      );
      const originalSemesterNumber = Number(
        originalSemester?.semester_number || 0,
      );
      const destinationSemesterNumber = originalSemesterNumber + 2;
      const destinationSemester = semesters.find(
        (semester) =>
          Number(semester.semester_number) === destinationSemesterNumber,
      );

      return {
        id: subject.id,
        name: subject.name,
        ects: Number(subject.ects || 0),
        originalSemesterLabel: originalSemester?.name || "Nepoznat semestar",
        destinationSemesterLabel: destinationSemester?.name || "",
        hasDestinationSemester: Boolean(destinationSemester),
      };
    });
}
