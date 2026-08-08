# Módulo Content
Libros (EPUB), audiolibros (signed URL), videos (Bunny/Mux signed), consejo del día, progreso.
Endpoints: `/content/daily-tip`, `/content/books(/:id/file)`, `/content/audiobooks(/:id/file)`,
`/content/videos(/:id/play)`, `PUT /content/progress`.
Nunca exponer URLs directas de media. Todo detrás del muro (entitlement active).
