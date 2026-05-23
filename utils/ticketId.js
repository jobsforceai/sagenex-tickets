export function generateTicketId() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `SGX-${ymd}-${random}`;
}
