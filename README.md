# 🥔 Papa Online

Juego multijugador en tiempo real basado en el clásico "Juego de la Papa" o "Números".

**[▶️ Jugar Ahora](#)** <!-- Agregar link cuando esté desplegado -->

## 📖 Descripción

Papa Online es una versión digital del tradicional juego de papel y lápiz donde dos jugadores compiten para conectar números en secuencia sin que sus líneas se crucen. El último jugador que pueda hacer un movimiento válido, gana.

## 🎮 Cómo Jugar

1. **Crear o unirse a una sala** con un código de 6 caracteres
2. **Esperar al oponente** para comenzar
3. **Conectar los números en orden** (1→2→3...) dibujando líneas
4. **¡Cuidado!** Si tu línea cruza otra línea (tuya o del oponente), pierdes
5. **Gana** el último jugador que logre hacer un movimiento válido

## ✨ Características

- 🌐 **Multijugador en tiempo real** con Socket.IO
- 📱 **Mobile-friendly** - juega desde cualquier dispositivo
- 🎨 **Diseño "sketchy"** con estética de papel y lápiz
- 📊 **Estadísticas locales** para seguir tu progreso
- 🔄 **Reconexión automática** - continúa tu partida si pierdes conexión
- ❓ **FAQ integrada** con reglas y ayuda
- 🎯 **Puntos configurables** (5, 10, 15, 20)

## 🛠️ Tecnologías

- **Frontend**: HTML, CSS (Vanilla), JavaScript
- **Backend**: Node.js + Express
- **Comunicación**: Socket.IO
- **Testing**: Jest
- **CI/CD**: GitHub Actions
- **Deployment**: Docker

## 🚀 Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/iyaki/papa-online.git
cd papa-online

# Instalar dependencias
cd server && npm install

# Ejecutar en modo desarrollo
npm run dev

# Abrir navegador en http://localhost:3000
```

## 🧪 Testing

```bash
# Ejecutar todos los tests
npm test

# Con coverage
npm test -- --coverage
```

**Cobertura actual**: 12 tests (7 unit + 5 integration) ✅

## 🐳 Deployment con Docker

```bash
# Build y Run
docker-compose up -d

# Ver logs
docker-compose logs -f
```

Ver [DEPLOYMENT.md](./DEPLOYMENT.md) para guía completa de deployment en VPS.

## 📁 Estructura del Proyecto

```
papa-online/
├── client/          # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── style.css
│   ├── main.js
│   ├── game.js
│   └── collision.js
├── server/          # Backend (Node.js)
│   ├── server.js
│   └── package.json
├── .github/         # CI/CD workflows
├── Dockerfile
├── docker-compose.yml
└── DEPLOYMENT.md
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT.

## 👤 Autor

**iyaki**
- Website: [iyaki.ar](https://iyaki.ar/)
- GitHub: [@iyaki](https://github.com/iyaki)

## 🎯 Créditos

- **Idea original**: Lucas Pacheco
- **Desarrollo**: iyaki

## 🐛 Reportar Bugs

¿Encontraste un bug? Por favor repórtalo a: contact@iyaki.ar

---

Hecho con 🧉 por [iyaki](https://iyaki.ar/)
