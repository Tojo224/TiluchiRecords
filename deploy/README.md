# Despliegue AWS de TiluchiRecords

## Topología

- EC2 `i-0700e5f68fff2c127` en `us-east-1` ejecuta web, backend, PostgreSQL, Redis y MinIO con `deploy/ec2/compose.yml`.
- La web pública es `https://tiluchirecords.bshadow.xyz`.
- La API se sirve en el mismo origen bajo `/api/v1`; nginx la envía al backend.
- Los archivos usan `https://media-tiluchirecords.bshadow.xyz` y URLs firmadas de MinIO.
- El túnel Cloudflare `tiluchirecords-aws-bridge` corre en la máquina Windows. Un SSH independiente reenvía los puertos locales `18080`, `19000` y `16379` a EC2. El túnel existente de otros proyectos no se modifica.
- `deploy/local-ai/compose.yml` ejecuta el worker con GPU local y monta modelos desde `D:\paquetes\tiluchirecords-ai-models`.

## Operación

La tarea programada `TiluchiRecords Bridge and AI` ejecuta `deploy/local-ai/start-bridge-hidden.vbs` al iniciar sesión y cada minuto, incluso si la laptop usa batería. Ese lanzador ejecuta `start-bridge.ps1` sin abrir una consola. `sync-network.ps1` consulta la IP pública mediante dos servicios, cambia solo la regla SSH IPv4 de TiluchiRecords a esa dirección `/32` y el script restablece el reenvío si la conexión anterior quedó caída. El cambio de Wi-Fi puede causar una interrupción breve, hasta la siguiente ejecución de la tarea.

La tarea usa el perfil AWS `tiluchi-ip-updater`, cuyo usuario IAM solo puede leer la instancia y sus reglas, y modificar la regla SSH `sgr-0b366f6be62e384fa`. La clave de acceso está cifrada con DPAPI para el usuario Windows actual en `%LOCALAPPDATA%\TiluchiRecords\roaming-ip-credential.bin`; no está en el repositorio. La copia de la IP de la EC2 está en `instance-ip.txt`. Esta máquina debe estar encendida, conectada y con Docker Desktop disponible para que el sitio y el procesamiento IA funcionen. La EC2 conserva los datos en volúmenes de Docker.

Para revisar los servicios de EC2:

```powershell
ssh -i C:\Users\LENOVO\.ssh\ficct-aws-deploy.pem ec2-user@3.221.159.115 "cd /opt/tiluchirecords && docker compose --env-file deploy/ec2/.env -f deploy/ec2/compose.yml ps"
```

Para revisar el worker local:

```powershell
docker compose --env-file deploy/ec2/.env -f deploy/local-ai/compose.yml ps
docker compose --env-file deploy/ec2/.env -f deploy/local-ai/compose.yml logs --tail=50 ai-worker
```

`deploy/ec2/.env` contiene secretos de producción y está ignorado por Git. La copia activa reside también en `/opt/tiluchirecords/deploy/ec2/.env` en EC2. No publicar ninguno de estos archivos.

## Límites actuales

- Cloudflare limita el tamaño de cada petición de subida según el plan; Free y Pro admiten hasta 100 MB. La aplicación admite archivos mayores, pero su subida actual es una única petición PUT. Se requiere subida multipartida para vídeos mayores.
- La instancia EC2 consume créditos o genera cargos AWS mientras esté encendida.
- La IP pública de EC2 puede cambiar al detenerla. `start-bridge.ps1` la consulta mediante el perfil limitado y conserva la última IP guardada si la consulta falla. Si la IP de la laptop cambia, la regla se actualiza automáticamente; si falla AWS o la conexión a internet, el script no amplía el acceso SSH.
