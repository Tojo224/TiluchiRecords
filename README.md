# TiluchiRecords — Plataforma Inteligente de Producción Musical y Audiovisual

> **Arquitectura:** Monorepo Modular (NestJS + Prisma + PostgreSQL + Redis + MinIO + Python AI Workers + React Responsive)  
> **Metodología:** Scrum v3.0 (2 Desarrolladores / 4 Sprints / 8 Semanas | 94 PHU)  
> **Memoria del Proyecto:** Engram (`tiluchirecords`)

---

## 1. Estructura del Monorepo

```text
TiluchiRecords/
├── .engram/               # Memoria persistente y trazabilidad de decisiones
├── backend/               # NestJS Monolito Modular + Prisma ORM (API Core)
│   ├── prisma/            # Esquema relacional (schema.prisma) y migraciones
│   └── src/               # Módulos: Auth, Projects, Media, Jobs, Providers
├── ai/                    # Workers y Motores de Inteligencia Artificial (Python)
│   └── src/               # Providers: Demucs, Librosa, FaceFusion, FFmpeg
├── web/                   # Cliente Web SPA Responsive (React + Vite + TailwindCSS)
├── docker-compose.yml     # Orquestación de infraestructura y servicios
└── .env.example           # Plantilla de variables de entorno
```

---

## 2. Puesta en Marcha Rápida (Docker)

### Prerrequisitos:
- Docker y Docker Compose instalados.

### 1. Configurar variables de entorno:
```bash
cp .env.example .env
```

### 2. Levantar toda la infraestructura:
```bash
docker compose up -d
```

Esto inicializará automáticamente:
- **PostgreSQL 16:** `localhost:5432` (`tiluchirecords_db`)
- **Redis 7:** `localhost:6379` (Colas y pub/sub)
- **MinIO (S3 API):** `http://localhost:9000` (Consola web: `http://localhost:9001`)
- **Backend NestJS:** `http://localhost:3000/api/v1`
- **AI Worker:** Conectado a Redis procesando jobs en segundo plano.

---

## 3. Desarrollo Local (Host)

Si preferís correr los servicios directamente en tu máquina host:

### Backend:
```bash
cd backend
npm install
npx prisma generate
npm run start:dev
```

### Frontend Web:
```bash
cd web
npm install
npm run dev
```

### AI Worker:
```bash
cd ai
pip install -r requirements.txt
python -m src.worker
```

---

## 4. Decisiones de Arquitectura Clave (R-1)

* **D-01 (Monorepo):** `/web`, `/backend` y `/ai` bajo un único control de versiones y compose.
* **D-02 (Proyecto como Contenedor):** El proyecto agrupa jobs y artefactos para permitir el flujo sin duplicación (`Karaoke -> Grabación -> Videoclip -> Face Swap`).
* **D-03 (MediaAsset Unificado):** Entidad centralizada con orígenes `UPLOADED | GENERATED` y estados de carga desacoplados.
* **D-04 (Estado UPLOADING):** Pertenece a `MediaAsset`, aislando la transferencia HTTP/S3 de la cola de procesamiento.
* **D-07 (Prisma ORM):** Tipado estricto en tiempo de compilación y migraciones consistentes.
