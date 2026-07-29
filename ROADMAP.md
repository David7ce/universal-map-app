# Roadmap

Trabajo futuro, nada de esto está implementado. Ver `CHANGELOG.md` para lo ya hecho y `README.md` para las desviaciones conocidas del v1.

## Pendiente (chico, sin bloqueo de diseño)

- **Isocrónico dinámico:** calcular la isócrona al momento (p.ej. al hacer click) requiere un servicio de rutas externo, lo cual choca con el non-goal "no backend, no paid services" del spec (Sección 11) salvo que se acepte explícitamente como excepción.

## Futuro (necesita diseño dedicado antes de tocar código)

La siguiente exige una decisión de arquitectura real (qué CRS/proyecciones concretas soportar) sin un segundo caso de uso real que la ejerza todavía — construir la abstracción ahora sería exactamente el tipo de "diseñar para un requisito hipotético" que este proyecto evita deliberadamente en el resto del código (ver Global Constraints del plan).
