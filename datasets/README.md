# Datasets de TiluchiRecords

Esta carpeta prepara formatos y validadores para organizar datos de tres tareas
de IA: karaoke, face swap y generación de video desde música. Cada tarea tiene
requisitos distintos, por eso sus manifiestos y esquemas están separados.

## Estado y alcance

- Los archivos Python generan ejemplos sintéticos y validan metadatos; no entrenan modelos.
- El chatbot Gemini, Demucs, Whisper, FaceFusion y los modelos de difusión no
  leen esta carpeta ni dependen de ella.
- Cada tarea contiene registros `synthetic` con archivos de medios y
  anotaciones generados por `generate_synthetic_datasets.py`.
- Los datos sintéticos no son grabaciones de personas ni mediciones de
  rendimiento de modelos. Su `split` es `not_applicable`.
- No se deben reportar estos registros ni sus etiquetas como entrenamiento,
  evaluación, consentimientos reales o métricas de los modelos.

## Estructura

```text
datasets/
├── records.py                 # Reglas compartidas y controles de rutas
├── validate_datasets.py       # Validador de manifiestos JSONL
├── generate_synthetic_datasets.py # Generador reproducible de medios sintéticos
├── karaoke/dataset.py         # Audio/video, stems y letra temporizada
├── face_swap/dataset.py       # Imagen fuente, video objetivo y consentimiento
└── music_video/dataset.py     # Audio, video de referencia y escenas anotadas
```

Los medios grandes y los documentos sensibles de consentimiento se almacenan
fuera de Git. En los manifiestos se usan rutas relativas a la carpeta de cada
tarea. Los registros face swap exigen consentimiento explícito y una referencia
a su comprobante; el comprobante no debe guardarse en este repositorio.

## Manifiestos y futuros datos reales

Cada línea de `manifest.jsonl` es un objeto JSON con:

- `record_id`: identificador opaco, sin nombres ni datos personales.
- `record_type`: `synthetic` para estos registros; los datos recopilados
  posteriormente deberán usar `real`.
- `split`: `not_applicable` para datos sintéticos; datos reales deberán usar
  `train`, `validation` o `test`, asignados con una política documentada.
- `source`: origen, licencia y estado de consentimiento; agregar
  `consent_reference` cuando se use `granted`.
- `assets`: rutas relativas de los medios y anotaciones.
- `annotations`: etiquetas revisables por una persona.

No hay porcentajes de partición para los ejemplos sintéticos. Las proporciones
para datos reales se decidirán según su volumen, procedencia y distribución,
antes de cualquier evaluación.

## Validación futura

Desde la raíz del repositorio:

```powershell
$datasetPath = (Resolve-Path datasets).Path
docker run --rm --mount "type=bind,source=$datasetPath,target=/workspace/datasets" grupal-ai-worker python /workspace/datasets/generate_synthetic_datasets.py
docker run --rm --mount "type=bind,source=$datasetPath,target=/workspace/datasets" -e PYTHONPATH=/workspace grupal-ai-worker python -m datasets.validate_datasets
```

El generador requiere Pillow y FFmpeg. El validador comprueba estructura y rutas
de metadatos; no descarga medios, no contacta servicios, no evalúa modelos y no
modifica la aplicación. El generador puede ejecutarse de nuevo: actualiza sus
propios registros sintéticos y conserva los demás registros del manifiesto.
