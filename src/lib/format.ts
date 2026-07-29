const currency = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const numero3 = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const dataBreve = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });
const dataOra = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" });

export const formatValuta = (n: number) => currency.format(n);
export const formatMillesimi = (n: number) => numero3.format(n);
export const formatData = (iso: string) => dataBreve.format(new Date(iso));
export const formatDataOra = (iso: string) => dataOra.format(new Date(iso));
