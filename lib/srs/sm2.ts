export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface SrsUpdate extends SrsState {
  dueDate: Date;
}

export function applySm2(state: SrsState, quality: number): SrsUpdate {
  if (quality < 0 || quality > 5) throw new RangeError('quality must be 0–5');

  let { easeFactor, intervalDays, repetitions } = state;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    if (repetitions === 0) intervalDays = 1;
    else if (repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
    repetitions += 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + intervalDays);
  dueDate.setHours(0, 0, 0, 0);

  return { easeFactor, intervalDays, repetitions, dueDate };
}
