/** Must match backend marketplace.models CATEGORY_CHOICES (value is stored). */
export const CATEGORY_OPTIONS = [
  { value: "other", label: "Other" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "cleaning", label: "Cleaning" },
  { value: "repair", label: "Repair" },
  { value: "construction", label: "Construction" },
] as const;

/** Must match backend marketplace.models CITY_CHOICES (value is stored). */
export const CITY_OPTIONS = [
  { value: "other", label: "Other" },
  { value: "yerevan", label: "Yerevan" },
  { value: "gyumri", label: "Gyumri" },
  { value: "vanadzor", label: "Vanadzor" },
  { value: "abovyan", label: "Abovyan" },
  { value: "ejmiatsin", label: "Ejmiatsin" },
] as const;

/** Must match backend JobRequest.Visibility (value is stored). */
export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "draft", label: "Draft" },
  { value: "verified_only", label: "Verified only" },
] as const;
