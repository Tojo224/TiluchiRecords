# Face swap

Esquema para futuros datos de investigación o evaluación de reemplazo facial.
Solo admite registros con consentimiento explícito y referencia verificable al
comprobante, que se conservará fuera de Git. No almacenar embeddings biométricos
ni documentos de identidad en esta carpeta.

Campos requeridos: `source_face_image`, `target_video`,
`face_annotations_json` y `annotations.target_person_ids`.
