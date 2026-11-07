/*
  Telefonos de WhatsApp. La gente escribe el numero de mil formas
  (11..., 011 15..., 54 11..., +54 9 11...). WhatsApp necesita el formato
  internacional de celular argentino: 549 + codigo de area + numero (13 digitos).
  Se usa en cliente y servidor: no importar nada de servidor aca.
*/

export function onlyDigits(value: string) {
  return value.replace(/\D+/g, '');
}

export function toWhatsAppNumber(raw: string) {
  let digits = onlyDigits(raw);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('549')) return digits;
  if (digits.startsWith('54') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  // 11 15 1234 5678: el "15" de celular sobra en el formato internacional.
  if (digits.length === 12 && digits.startsWith('1115')) digits = `11${digits.slice(4)}`;
  if (digits.length === 10) return `549${digits}`;
  return digits;
}

// Un numero argentino tiene que quedar con 13 digitos; uno de otro pais,
// entre 10 y 15 (no lo podemos validar mejor sin saber el pais).
export function isValidWhatsAppNumber(waNumber: string) {
  if (waNumber.startsWith('549')) return waNumber.length === 13;
  if (waNumber.startsWith('54')) return false;
  return waNumber.length >= 10 && waNumber.length <= 15;
}

export function prettyPhone(raw: string) {
  const wa = toWhatsAppNumber(raw);
  // 549 11 6445 0430 (Buenos Aires: area de 2 digitos)
  const ba = wa.match(/^549(11)(\d{4})(\d{4})$/);
  if (ba) return `+54 9 ${ba[1]} ${ba[2]}-${ba[3]}`;
  const other = wa.match(/^549(\d{3,4})(\d{6,7})$/);
  if (other) return `+54 9 ${other[1]} ${other[2]}`;
  return `+${wa}`;
}
