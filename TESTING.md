# Testing Guide - Papa Online

## Configuración de Tests

Este proyecto utiliza **Jest** como framework de testing para asegurar la integridad del código durante el desarrollo.

## Ejecutar Tests

Desde la raíz del proyecto:

```bash
npm test
```

Desde el directorio del servidor:

```bash
cd server
npm test
```

## Cobertura de Tests

### ✅ Unit Tests (7 tests)

#### Funciones de Gestión de Salas
- **generateNumbers**: Verificación de generación correcta de puntos
- **checkOverlap**: Detección de puntos superpuestos
- **Generación de códigos de sala**: Validación de formato de 6 caracteres alfanuméricos

#### Lógica del Juego
- **Validación de secuencia de turnos**: Verificación de números correctos
- **Seguimiento de progreso**: Estado de completitud del juego
- **Alternancia de turnos**: Cambio correcto entre jugadores

#### Gestión de Sesiones
- **Generación de UUID**: Validación de formato UUID v4

### ✅ Integration Tests (5 tests)

#### Comunicación Socket.IO
- **Conexión con autenticación**: Verificación de token en handshake
- **Creación de sala**: Emisión de eventos `room_created` y `game_start`
- **Unión a sala**: Sincronización de dos jugadores en la misma sala
- **Movimientos por turnos**: Validación de `move_made` y cambio de turno
- **Game Over**: Correcta identificación de ganador y perdedor

## GitHub Actions - CI/CD

El proyecto cuenta con GitHub Actions configurado para ejecutar los tests automáticamente en:
- Cada push a las ramas `main` o `master`
- Cada Pull Request
- Manualmente mediante workflow_dispatch

Los tests se ejecutan en:
- Node.js 18.x
- Node.js 20.x

**Ubicación del workflow**: `.github/workflows/test.yml`

## Resultados Esperados

Cuando ejecutes `npm test`, deberías ver:

```
PASS  ./server.test.js
  Room Management - Helper Functions
    ✓ generateNumbers should create correct number of points
    ✓ checkOverlap should detect close points
    ✓ room code generation should create 6 character alphanumeric codes
  Game Logic
    ✓ should validate turn sequence
    ✓ should track game progress
    ✓ should alternate turns between two players
  Session Management
    ✓ should generate valid UUID format

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

## Agregar Nuevos Tests

Para agregar tests adicionales, edita `server/server.test.js` siguiendo el patrón existente:

```javascript
describe('Feature Name', () => {
    test('should do something specific', () => {
        // Arrange
        const input = ...;
        
        // Act
        const result = functionToTest(input);
        
        // Assert
        expect(result).toBe(expectedValue);
    });
});
```

## Próximos Pasos para Testing

1. **Tests de Integración**: Agregar tests que verifiquen la comunicación Socket.IO
2. **Tests E2E**: Implementar tests de extremo a extremo con Playwright
3. **Tests de Detección de Colisiones**: Validar la lógica de intersección de líneas
4. **Tests de Reconexión**: Verificar la persistencia de sesión

## Comandos Disponibles

| Comando                  | Descripción                                           |
| ------------------------ | ----------------------------------------------------- |
| `npm test`               | Ejecuta todos los tests                               |
| `npm test -- --coverage` | Ejecuta tests con reporte de cobertura                |
| `npm test -- --watch`    | Ejecuta tests en modo watch (útil durante desarrollo) |

## Notas Importantes

- Los tests se ejecutan de forma aislada y no interfieren con el servidor de desarrollo
- No es necesario detener `npm run dev` para ejecutar los tests
- Los tests actuales son **unit tests** de funciones puras, no requieren servidor corriendo
