# Micronauta en vivo (pestaña Tráfico)

Servicio chico que corre en una PC con Chrome, entra a Micronauta con Selenium y publica la pantalla en vivo para el tablero:

| Flota | Usuario | Vista que queda en pantalla |
|---|---|---|
| Córdoba | `svidela` | Vistas → Vista Corredores |
| Comodoro | `leonardov` | Vistas → Activos |

## Puesta en marcha (Windows)

1. Doble clic en `iniciar.bat`. La primera vez crea `.env` y lo abre en el Bloc de notas: completá `CORDOBA_PASSWORD` y `COMODORO_PASSWORD`, guardá y volvé a ejecutarlo.
2. Dejá la ventana abierta. El tablero (Tráfico) muestra ambas flotas y se actualiza cada 3 segundos.

- `iniciar.bat --visible` abre las ventanas de Chrome para ver qué hace (útil la primera vez).
- `iniciar.bat --lan` permite que otras PCs vean el vivo: en el tablero, ⚙ en Tráfico → `http://IP-de-esta-PC:8765`.
- Si Micronauta cambia los nombres del menú, se ajustan en `.env` (`CORDOBA_PASOS`, `COMODORO_PASOS`), sin tocar código.
- Si se cae la sesión, vuelve a entrar solo; además recarga la vista cada 30 minutos.

Las contraseñas quedan sólo en `.env` de esta PC (está en `.gitignore`): nunca viajan al tablero ni al repositorio.
