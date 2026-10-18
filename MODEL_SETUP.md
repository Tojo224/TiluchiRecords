# Modelos IA locales

Los modelos no forman parte del repositorio. Docker los conserva en los volumenes
nombrados `ai_models` y `facefusion_models`, por lo que no se descargan nuevamente
al recrear los contenedores.

## Preparacion completa

Antes de utilizar las funciones de IA, se pueden descargar todos los modelos con:

```bash
docker compose --profile models run --rm ai-models-init
```

La descarga inicial requiere Internet, al menos 8 GB libres y puede tomar bastante
tiempo. Si un modelo de Hugging Face requiere aceptar una licencia, se debe definir
`HF_TOKEN` en el archivo `.env`.

## Preparacion parcial

Tambien se pueden preparar solo determinados motores:

```bash
docker compose --profile models run --rm ai-models-init \
  python scripts/download_models.py demucs whisper
```

Los componentes disponibles son:

- `demucs`
- `whisper`
- `diffusion`
- `video-diffusion`
- `facefusion`

Si no se ejecuta el inicializador, cada proveedor intenta descargar su modelo en el
primer uso y lo conserva en el volumen correspondiente.

## Eliminacion deliberada

Los modelos solo se eliminan al borrar sus volumenes:

```bash
docker volume rm grupal_ai_models grupal_facefusion_models
```

Este comando obliga a descargar nuevamente todos los modelos y no debe formar parte
de una limpieza normal del proyecto.
