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

// Versículos de ánimo, perseverancia y esperanza (Reina-Valera 1909) para
// celebrar cuando se sube de nivel en Quests — el esfuerzo real de la
// persona, no la app, es lo que vale.
export const LEVEL_UP_VERSES: { text: string; ref: string }[] = [
  { text: "Esforzaos y cobrad ánimo, todos los que esperáis en Jehová.", ref: "Salmos 31:24" },
  { text: "He peleado la buena batalla, he acabado la carrera, he guardado la fe.", ref: "2 Timoteo 4:7" },
  { text: "No nos cansemos, pues, de hacer bien; porque a su tiempo segaremos, si no desmayamos.", ref: "Gálatas 6:9" },
  { text: "Bienaventurado el varón que soporta la tentación; porque cuando fuere probado, recibirá la corona de vida.", ref: "Santiago 1:12" },
  { text: "Sé fuerte y valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.", ref: "Josué 1:9" },
  { text: "Prosigo a la meta, al premio de la soberana vocación de Dios en Cristo Jesús.", ref: "Filipenses 3:14" },
  { text: "Corramos con paciencia la carrera que nos es propuesta.", ref: "Hebreos 12:1" },
  { text: "El que persevere hasta el fin, éste será salvo.", ref: "Mateo 24:13" },
  { text: "Fortaleceos en el Señor, y en la potencia de su fortaleza.", ref: "Efesios 6:10" },
  { text: "Mas los que esperan a Jehová tendrán nuevas fuerzas; levantarán las alas como águilas.", ref: "Isaías 40:31" },
  { text: "Alzaré mis ojos a los montes, ¿de dónde vendrá mi socorro? Mi socorro viene de Jehová.", ref: "Salmos 121:1-2" },
  { text: "Todo lo puedo en Cristo que me fortalece.", ref: "Filipenses 4:13" },
  { text: "El gozo de Jehová es vuestra fuerza.", ref: "Nehemías 8:10" },
  { text: "Y no nos cansemos de hacer bien, que a su tiempo segaremos.", ref: "Gálatas 6:9" },
  { text: "Bienaventurados los que padecen persecución por causa de la justicia, porque de ellos es el reino de los cielos.", ref: "Mateo 5:10" },
  { text: "La aflicción produce paciencia, y la paciencia prueba, y la prueba esperanza.", ref: "Romanos 5:3-4" },
];

export function verseForLevel(level: number): { text: string; ref: string } {
  return LEVEL_UP_VERSES[level % LEVEL_UP_VERSES.length];
}
