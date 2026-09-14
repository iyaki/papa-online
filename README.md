# 🥔 Papa Online

Real-time multiplayer game based on the classic "Juego de la Papa" or "Números" paper game.

**[▶️ Play Now](#)** <!-- Add link once deployed -->

## 📖 Description

Papa Online is a digital version of the traditional paper-and-pencil game where two players compete to connect numbers in sequence without their lines crossing. The last player able to make a valid move wins.

## 🎮 How to Play

1. **Create or join a room** with a 6-character code
2. **Wait for the opponent** to start
3. **Connect the numbers in order** (1→2→3...) by drawing lines
4. **Careful!** If your line crosses another line (yours or the opponent's), you lose
5. The last player who manages to make a valid move **wins**

For the step-by-step guide to each feature (use cases), see [USE_CASES.md](./docs/USE_CASES.md).

## ✨ Features

- 🌐 **Real-time multiplayer** with Socket.IO
- 📱 **Mobile-friendly** - play from any device
- 🎨 **"Sketchy" design** with a paper-and-pencil look
- 📊 **Local statistics** to track your progress
- 🎯 **Configurable points** (10, 15, 20, 25, 30)
- ❓ **Built-in FAQ** with rules and help

## 🛠️ Technologies

- **Frontend**: HTML, CSS (Vanilla), JavaScript
- **Backend**: Node.js + Express
- **Communication**: Socket.IO
- **Testing**: Jest
- **CI/CD**: GitHub Actions
- **Deployment**: Docker

## 🚀 Local Installation

```bash
# Clone the repository
git clone https://github.com/iyaki/papa-online.git
cd papa-online

# Install dependencies
cd server && npm install

# Run in development mode
npm run dev

# Open your browser at http://localhost:3000
```

## 🧪 Testing

```bash
# Run all tests
npm test

# With coverage
npm test -- --coverage
```

**Current coverage**: 15 tests (7 unit + 8 integration) ✅

## 🐳 Docker Deployment

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full VPS deployment guide.

## 📁 Project Structure

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

## 🤝 Contributing

Contributions are welcome. Please:

For the spec-driven workflow (mandatory for AI agents), see [AGENTS.md](./AGENTS.md).

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT license.

## 👤 Author

**iyaki**
- Website: [iyaki.ar](https://iyaki.ar/)
- GitHub: [@iyaki](https://github.com/iyaki)

## 🎯 Credits

- **Original idea**: Lucas Pacheco
- **Development**: iyaki

## 🐛 Report Bugs

Found a bug? Please report it to: contact@iyaki.ar

---

Made with 🧉 by [iyaki](https://iyaki.ar/)
