export type PhoneCountry = {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
  /** Typical national length after stripping a leading 0 */
  nationalLength: number;
  placeholder: string;
};

/** Curated list for onboarding. Zimbabwe is first and the app default. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "ZW", name: "Zimbabwe", dialCode: "263", flag: "🇿🇼", nationalLength: 9, placeholder: "7X XXX XXXX" },
  { iso: "ZA", name: "South Africa", dialCode: "27", flag: "🇿🇦", nationalLength: 9, placeholder: "8X XXX XXXX" },
  { iso: "BW", name: "Botswana", dialCode: "267", flag: "🇧🇼", nationalLength: 8, placeholder: "7X XXX XXX" },
  { iso: "ZM", name: "Zambia", dialCode: "260", flag: "🇿🇲", nationalLength: 9, placeholder: "9X XXX XXXX" },
  { iso: "MZ", name: "Mozambique", dialCode: "258", flag: "🇲🇿", nationalLength: 9, placeholder: "8X XXX XXXX" },
  { iso: "MW", name: "Malawi", dialCode: "265", flag: "🇲🇼", nationalLength: 9, placeholder: "9XX XXX XXX" },
  { iso: "NA", name: "Namibia", dialCode: "264", flag: "🇳🇦", nationalLength: 9, placeholder: "8X XXX XXXX" },
  { iso: "KE", name: "Kenya", dialCode: "254", flag: "🇰🇪", nationalLength: 9, placeholder: "7XX XXX XXX" },
  { iso: "TZ", name: "Tanzania", dialCode: "255", flag: "🇹🇿", nationalLength: 9, placeholder: "7XX XXX XXX" },
  { iso: "UG", name: "Uganda", dialCode: "256", flag: "🇺🇬", nationalLength: 9, placeholder: "7XX XXX XXX" },
  { iso: "NG", name: "Nigeria", dialCode: "234", flag: "🇳🇬", nationalLength: 10, placeholder: "80X XXX XXXX" },
  { iso: "GH", name: "Ghana", dialCode: "233", flag: "🇬🇭", nationalLength: 9, placeholder: "2X XXX XXXX" },
  { iso: "GB", name: "United Kingdom", dialCode: "44", flag: "🇬🇧", nationalLength: 10, placeholder: "7XXX XXXXXX" },
  { iso: "US", name: "United States", dialCode: "1", flag: "🇺🇸", nationalLength: 10, placeholder: "201 XXX XXXX" },
  { iso: "CA", name: "Canada", dialCode: "1", flag: "🇨🇦", nationalLength: 10, placeholder: "416 XXX XXXX" },
  { iso: "AE", name: "United Arab Emirates", dialCode: "971", flag: "🇦🇪", nationalLength: 9, placeholder: "5X XXX XXXX" },
  { iso: "IN", name: "India", dialCode: "91", flag: "🇮🇳", nationalLength: 10, placeholder: "98XXX XXXXX" },
  { iso: "AU", name: "Australia", dialCode: "61", flag: "🇦🇺", nationalLength: 9, placeholder: "4XX XXX XXX" },
  { iso: "CN", name: "China", dialCode: "86", flag: "🇨🇳", nationalLength: 11, placeholder: "1XX XXXX XXXX" },
];

export const DEFAULT_PHONE_COUNTRY =
  PHONE_COUNTRIES.find((country) => country.iso === "ZW") ?? PHONE_COUNTRIES[0];

export function findPhoneCountry(isoOrDial: string): PhoneCountry {
  const needle = isoOrDial.trim().toUpperCase();
  return (
    PHONE_COUNTRIES.find((country) => country.iso === needle) ||
    PHONE_COUNTRIES.find((country) => country.dialCode === isoOrDial.replace(/\D/g, "")) ||
    DEFAULT_PHONE_COUNTRY
  );
}
