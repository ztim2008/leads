export type NameGender = "male" | "female" | "unknown";
export type ClientGenderFilter = "all" | "male" | "female";

const MALE = new Set(
  [
    "александр", "алексей", "анатолий", "андрей", "антон", "аркадий", "арсений", "артём", "артем",
    "борис", "вадим", "валентин", "валерий", "василий", "виктор", "виталий", "владимир", "владислав",
    "вячеслав", "геннадий", "георгий", "глеб", "григорий", "данил", "даниил", "данила", "денис",
    "дмитрий", "евгений", "егор", "иван", "игорь", "илья", "кирилл", "константин", "кузьма", "лев",
    "леонид", "максим", "марк", "матвей", "михаил", "никита", "николай", "олег", "павел", "пётр",
    "петр", "платон", "роман", "руслан", "савва", "семён", "семен", "сергей", "станислав", "степан",
    "тимофей", "тимур", "фёдор", "федор", "фома", "юрий", "ярослав", "эдуард", "эммануил",
  ].map(norm),
);

const FEMALE = new Set(
  [
    "александра", "алина", "алла", "алена", "алёна", "анастасия", "ангелина", "анна", "антонина",
    "арина", "валентина", "валерия", "варвара", "вера", "вероника", "виктория", "галина", "дарья",
    "диана", "евгения", "екатерина", "елена", "елизавета", "жанна", "зинаида", "зоя", "инна", "ирина",
    "карина", "кирилла", "кира", "кристина", "ксения", "лариса", "лидия", "лиза", "любовь", "людмила",
    "майя", "марина", "мария", "маргарита", "милана", "надежда", "наталья", "наталия", "нина",
    "оксана", "ольга", "полина", "раиса", "регина", "римма", "светлана", "софия", "софья", "тамара",
    "татьяна", "ульяна", "эльвира", "юлия", "юля", "яна", "настя", "даша", "вика", "катя", "лена",
    "таня", "оля", "маша", "настя",
  ].map(norm),
);

const AMBIGUOUS = new Set(
  ["саша", "женя", "валя", "слава", "жека", "ваня", "вася", "паша"].map(norm),
);

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/ё/g, "е");
}

export function firstNameFromAuthor(author?: string | null): string {
  if (!author?.trim()) return "";
  return norm(author).split(/[\s.]+/).filter(Boolean)[0] || "";
}

export function genderFromName(author?: string | null): NameGender {
  const first = firstNameFromAuthor(author);
  if (!first || AMBIGUOUS.has(first)) return "unknown";
  if (MALE.has(first)) return "male";
  if (FEMALE.has(first)) return "female";
  if (/^(никита|илья|данила|кузьма|фома|савва)$/.test(first)) return "male";
  if (first.length >= 3 && /[ая]$/.test(first) && !/ила$/.test(first)) return "female";
  return "unknown";
}

export function passesGenderFilter(
  author: string | null | undefined,
  filter: ClientGenderFilter | string | null | undefined,
): boolean {
  const mode: ClientGenderFilter =
    filter === "male" || filter === "female" ? filter : "all";
  if (mode === "all") return true;
  return genderFromName(author) === mode;
}
