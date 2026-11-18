/**
 * Help manual content, one section per user flow.
 *
 * Pure data (no JSX) so it can be unit tested. Copy is Spanish without
 * accents (project convention) and every statement mirrors the real UI:
 * button labels, requirements and error messages come from the pages under
 * `features/`.
 */

export type HelpTroubleshooting = {
  problem: string;
  solution: string;
};

export type HelpSection = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
  troubleshooting?: HelpTroubleshooting[];
  /** Tour mission that practices this section interactively. */
  missionId?: string;
};

export const HELP_SECTIONS: readonly HelpSection[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    summary:
      "Un proyecto es la carpeta de tu produccion: guarda tus archivos y todo lo que generes.",
    steps: [
      "Abre Proyectos en el menu y pulsa Nuevo proyecto.",
      "Ponle un nombre y pulsa Crear proyecto.",
      "Dentro del proyecto elige una herramienta: Karaoke, Video desde musica o Face swap.",
      "Para ver todo lo que subiste o generaste, usa Archivos y Resultados.",
    ],
    tips: [
      "El orden creativo sugerido es Karaoke, luego Video desde musica y por ultimo Face swap.",
      "El boton Guia (abajo a la derecha) lista misiones paso a paso y marca las que ya completaste.",
    ],
    missionId: "create-project",
  },
  {
    id: "karaoke",
    title: "Karaoke",
    summary:
      "Convierte un video con musica en una version instrumental con la letra sincronizada, y canta encima.",
    steps: [
      "Entra al proyecto y abre Karaoke.",
      "Pulsa Subir video, o elige uno que ya tengas en Video del proyecto. El video debe contener musica con letra cantada.",
      "Pulsa Crear karaoke. Veras el avance mientras se procesa.",
      "Cuando termine, aparece Video karaoke. Pulsa Cantar.",
      "Pulsa Comenzar a cantar y permite el acceso al microfono cuando el navegador lo pida.",
      "Canta siguiendo la letra. Al terminar el video, ponle un nombre a la pieza y pulsa Guardar interpretacion.",
    ],
    tips: [
      "Usa audifonos para evitar eco.",
      "Una vez que empiezas a cantar, el video y la grabacion no se pueden pausar.",
      "Si sales antes de guardar, la interpretacion no se guarda.",
      "Para cantar usa una version reciente de Chrome o Edge.",
      "Tu interpretacion se guarda en Resultados, en Interpretaciones karaoke.",
    ],
    troubleshooting: [
      {
        problem: "El boton Crear karaoke esta desactivado.",
        solution:
          "Debajo del boton dice que falta. Normalmente es subir o seleccionar un video con musica, o esperar a que termine el proceso en curso.",
      },
      {
        problem: "No se pudo reconocer suficiente letra cantada en este video.",
        solution: "Prueba con una pista donde la voz sea mas clara.",
      },
      {
        problem: "El archivo seleccionado no contiene una pista de video.",
        solution: "Selecciona un video MP4 o MPEG valido.",
      },
      {
        problem:
          "Debes permitir el acceso al microfono para iniciar el karaoke.",
        solution:
          "Permite el microfono en el navegador y pulsa Intentar nuevamente.",
      },
      {
        problem: "Este navegador no permite grabar el microfono y el video.",
        solution: "Usa una version reciente de Chrome o Edge.",
      },
    ],
    missionId: "create-karaoke",
  },
  {
    id: "video-desde-musica",
    title: "Video desde musica",
    summary:
      "Crea un videoclip en dos fases: primero un plan de escenas que puedes revisar, despues la generacion del video.",
    steps: [
      "Entra al proyecto y abre Video desde musica.",
      "Pulsa Subir musica, o elige una pieza en Musica del proyecto.",
      "Fase 1: escribe la Direccion visual, que describe el estilo que quieres. Ya trae un texto de ejemplo que puedes cambiar.",
      "Pulsa Analizar y crear plan. Se analiza la musica y se prepara el plan de escenas.",
      "Revisa las escenas que aparecen en la pagina.",
      "Fase 2: cuando estes conforme, pulsa Generar videoclip. Se generan los clips y se unen con la musica.",
      "Al terminar veras el Videoclip final, que tambien queda en Resultados.",
    ],
    tips: [
      "La Direccion visual es obligatoria: sin ella no se puede crear el plan.",
      "La Fase 2 se habilita solo cuando el plan de escenas esta listo.",
      "Si quieres otro plan, pulsa Crear un nuevo plan.",
    ],
    troubleshooting: [
      {
        problem: "Analizar y crear plan esta desactivado.",
        solution:
          "Falta subir o seleccionar una pieza musical, escribir la direccion visual, o esperar a que termine el proceso en curso.",
      },
      {
        problem: "Generar videoclip esta desactivado.",
        solution:
          "Primero crea el plan de escenas en la Fase 1. Tambien hace falta tener una pieza musical seleccionada.",
      },
    ],
    missionId: "create-plan",
  },
  {
    id: "face-swap",
    title: "Face swap",
    summary:
      "Reemplaza el rostro de una o varias personas de un video por el rostro de una imagen tuya.",
    steps: [
      "Entra al proyecto y abre Face swap.",
      "Sube o elige la imagen con el rostro de origen.",
      "Sube o elige el video donde quieres hacer el reemplazo.",
      "Espera la deteccion automatica de personas: se analiza el video y aparecen las personas encontradas.",
      "Selecciona una o varias personas para reemplazar.",
      "Marca la casilla de Confirmacion: confirmas que tienes derechos o autorizacion sobre los archivos.",
      "Pulsa Iniciar reemplazo. Si elegiste varias personas, el boton dice Reemplazar N personas.",
      "Cuando termine, el video aparece como Video generado.",
    ],
    tips: [
      "Debes tener derechos o autorizacion sobre la imagen y el video que uses.",
      "Si el video tiene una sola persona detectada, se selecciona automaticamente.",
      "Este flujo es opcional: no hace falta para completar los demas.",
    ],
    troubleshooting: [
      {
        problem: "Iniciar reemplazo esta desactivado.",
        solution:
          "Debajo del boton dice que falta: imagen, video, esperar la deteccion y elegir personas, o aceptar la confirmacion.",
      },
      {
        problem: "No se detectaron rostros utilizables en este video.",
        solution: "Prueba con un video mas nitido o con rostros visibles.",
      },
      {
        problem: "La deteccion fallo.",
        solution: "Pulsa Reintentar deteccion.",
      },
    ],
    missionId: "face-swap",
  },
  {
    id: "archivos-y-resultados",
    title: "Archivos y Resultados",
    summary:
      "Archivos muestra lo que subiste y lo que se genero. Resultados muestra solo los videos finales.",
    steps: [
      "Abre Archivos para subir musica, videos o rostros con Subir musica, Subir video y Subir rostro.",
      "En Archivos cargados estan los recursos que agregaste tu.",
      "En Archivos generados estan los resultados creados por Karaoke, Face swap y Video desde musica.",
      "Para bajar un archivo, usa el boton Descargar de su fila.",
      "Para borrar un archivo de Archivos, usa el boton Eliminar y confirma. Esta accion no se puede deshacer desde la aplicacion.",
      "Abre Resultados para ver y descargar solo los entregables finales: videos karaoke, interpretaciones, face swap y videoclips.",
    ],
    tips: [
      "Los resultados se agrupan por tipo, y cada grupo indica si todavia esta vacio.",
    ],
  },
  {
    id: "procesos-y-tiempos",
    title: "Procesos y tiempos de espera",
    summary:
      "Crear karaoke, el plan de escenas, los clips y el face swap son procesos que tardan. Se hacen en segundo plano.",
    steps: [
      "Cuando inicias un proceso, el boton cambia de texto y aparece una barra de avance.",
      "Mientras corre, las acciones que dependen de el se desactivan y la pagina te dice que falta esperar.",
      "Puedes cambiar de pagina y volver: el proceso sigue en el proyecto.",
      "Cuando termina, el resultado aparece en la misma pagina y en Resultados.",
    ],
    tips: [
      "Si un proceso falla, la pagina muestra un mensaje en rojo. Corrige lo indicado y vuelve a intentarlo.",
      "El proceso que ya esta corriendo termina aunque salgas de la pagina, pero ve a revisar el resultado cuando termine.",
      "En Video desde musica, los pasos se encadenan desde esa pagina (el plan de escenas despues del analisis y la composicion despues de los clips). Si sales a mitad del proceso, el siguiente paso empieza cuando vuelves a Video desde musica.",
    ],
  },
  {
    id: "problemas-frecuentes",
    title: "Problemas frecuentes",
    summary: "Los mensajes mas comunes de la aplicacion y como resolverlos.",
    steps: [
      "Lee el mensaje que aparece en la pagina o debajo del boton desactivado: indica que falta.",
      "Revisa las secciones de cada flujo arriba para ver los requisitos.",
      "Si el problema sigue, repite la accion o recarga la pagina.",
    ],
    troubleshooting: [
      {
        problem: "Falta: subir o seleccionar un video con musica.",
        solution:
          "En Karaoke, sube un video o elige uno en Video del proyecto.",
      },
      {
        problem: "Falta: que termine el proceso en curso.",
        solution:
          "Espera a que termine la barra de avance. Luego la accion se habilita sola.",
      },
      {
        problem: "Falta: crear el plan de escenas en la Fase 1.",
        solution:
          "En Video desde musica pulsa Analizar y crear plan y espera a que este listo.",
      },
      {
        problem: "Falta: aceptar la confirmacion.",
        solution: "En Face swap marca la casilla de Confirmacion.",
      },
      {
        problem:
          "No se pudo generar el karaoke. Revisa el video seleccionado o vuelve a intentarlo.",
        solution:
          "Prueba con otro video que tenga musica con voz clara, o repite Crear karaoke.",
      },
      {
        problem:
          "Tu navegador no permite capturar la reproduccion del karaoke.",
        solution: "Usa Chrome o Edge para cantar.",
      },
    ],
  },
];
