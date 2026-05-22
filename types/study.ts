export interface DueCard {
  id: string;
  cardType: 'qa' | 'cloze' | 'multiple_choice';
  front: string;
  back: string;
  explanation: string | null;
  sourcePage: number | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueDate: string;
}
