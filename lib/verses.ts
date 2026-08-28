// Versículos cortos (Reina-Valera 1909, dominio público) para el resumen diario.
export const DAILY_VERSES: { text: string; ref: string }[] = [
  { text: "Encomienda a Jehová tu camino, y confía en él; y él hará.", ref: "Salmos 37:5" },
  { text: "Todo lo puedo en Cristo que me fortalece.", ref: "Filipenses 4:13" },
  { text: "Fíate de Jehová de todo tu corazón, y no estribes en tu prudencia.", ref: "Proverbios 3:5" },
  { text: "El gozo de Jehová es vuestra fuerza.", ref: "Nehemías 8:10" },
  { text: "No temas, porque yo soy contigo; no desmayes, porque yo soy tu Dios.", ref: "Isaías 41:10" },
  { text: "Todas las cosas ayudan a bien a los que a Dios aman.", ref: "Romanos 8:28" },
  { text: "Jehová es mi pastor; nada me faltará.", ref: "Salmos 23:1" },
  { text: "Echando toda vuestra solicitud en él, porque él tiene cuidado de vosotros.", ref: "1 Pedro 5:7" },
  { text: "Este es el día que hizo Jehová; nos gozaremos y alegraremos en él.", ref: "Salmos 118:24" },
  { text: "Y sabemos que a los que a Dios aman, todas las cosas les ayudan a bien.", ref: "Romanos 8:28" },
  { text: "Encomienda a Jehová tus obras, y tus pensamientos serán afirmados.", ref: "Proverbios 16:3" },
  { text: "El corazón del hombre piensa su camino; mas Jehová endereza sus pasos.", ref: "Proverbios 16:9" },
  { text: "Buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.", ref: "Mateo 6:33" },
  { text: "No os afanéis por el día de mañana; el día de mañana traerá su afán.", ref: "Mateo 6:34" },
  { text: "Esforzaos y cobrad ánimo; no temáis, ni tengáis miedo... porque Jehová tu Dios es el que va contigo.", ref: "Deuteronomio 31:6" },
  { text: "Mas los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas.", ref: "Isaías 40:31" },
  { text: "Todo tiene su tiempo, y todo lo que se quiere debajo del cielo tiene su hora.", ref: "Eclesiastés 3:1" },
  { text: "Porque yo sé los pensamientos que tengo acerca de vosotros... pensamientos de paz, y no de mal.", ref: "Jeremías 29:11" },
  { text: "Deléitate asimismo en Jehová, y él te dará las peticiones de tu corazón.", ref: "Salmos 37:4" },
  { text: "El principio de la sabiduría es el temor de Jehová.", ref: "Proverbios 9:10" },
  { text: "Mirad las aves del cielo, que no siembran, ni siegan... y vuestro Padre celestial las alimenta.", ref: "Mateo 6:26" },
  { text: "La paz os dejo, mi paz os doy; no como el mundo la da, yo os la doy.", ref: "Juan 14:27" },
  { text: "Alegraos en el Señor siempre: otra vez digo: Alegraos.", ref: "Filipenses 4:4" },
  { text: "Por nada estéis afanosos; sean conocidas vuestras peticiones delante de Dios en toda oración.", ref: "Filipenses 4:6" },
];

export function verseOfTheDay(date: Date = new Date()): { text: string; ref: string } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start) / (24 * 60 * 60 * 1000));
  return DAILY_VERSES[dayOfYear % DAILY_VERSES.length];
}
