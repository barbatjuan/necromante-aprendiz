# Necromante Aprendiz

RPG 2D de acción en el navegador. Eres un necromante aprendiz: derrota a los vivos, roba su esencia, alza sus cadáveres como siervos y conquista la tierra y el cielo.

**Jugar:** https://barbatjuan.github.io/necromante-aprendiz/

## Controles

| Tecla | Acción |
|---|---|
| WASD | Moverse |
| Ratón | Apuntar |
| Clic izquierdo / J | Golpe de hoz |
| E | Alzar muerto (en la guarida: hablar / usar el altar) |
| Q | Explosión de cadáver |
| F | Cosecha de almas |
| V | Furia necrótica |
| R | Ordenar a tus siervos atacar al enemigo bajo el cursor |
| B | Libro de necromancia |
| Esc | Pausa |

## Multijugador cooperativo (hasta 4)

1. Un jugador pulsa **H** en el título para crear una sala y comparte el código de 5 letras que aparece.
2. Los demás pulsan **U**, escriben el código y pulsan Enter.

La partida (guarida, progreso y mejoras) es la del anfitrión. La esencia es compartida y cada necromante tiene sus propios siervos.
La conexión es directa entre navegadores (WebRTC con [PeerJS](https://peerjs.com)); algunas redes muy restrictivas pueden impedirla.

## Jugar sin internet

Descarga el repositorio y abre `index.html` con doble clic (el modo multijugador necesita internet).
