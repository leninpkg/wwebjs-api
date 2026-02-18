export default function onlyDigits(input: string): string {
  return input.replace(/\D/g, "");
}