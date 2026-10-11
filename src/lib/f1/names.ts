export function driverName(d: { givenName: string; familyName: string }) {
  return `${d.givenName} ${d.familyName}`;
}
