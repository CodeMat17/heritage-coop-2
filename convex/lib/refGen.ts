export function generateRegistrationRef(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `HC-${year}-${suffix}`;
}
