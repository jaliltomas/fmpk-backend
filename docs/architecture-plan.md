# Plan Arquitectónico de Alto Nivel para Codex Backend

## 1. Visión General
Codex es una plataforma de *matchmaking* de productos construida con NestJS, TypeORM y PostgreSQL, exponiendo APIs REST documentadas con Swagger y capacidades de comunicación en tiempo real mediante WebSockets (socket.io). El objetivo del backend es ofrecer un núcleo modular y escalable que permita iterar rápidamente sobre funcionalidades de descubrimiento, comparación y conexión entre productos y compradores.

## 2. Principios de Arquitectura
- **Modularidad fuerte**: cada dominio principal del negocio se encapsula en un módulo NestJS con sus entidades, DTOs, servicios, controladores y gateways.
- **DDD liviano**: separación clara entre capas de dominio (entidades + servicios de negocio), aplicación (casos de uso/servicios), transporte (controladores/gateways) y persistencia (repositorios TypeORM).
- **Convenciones consistentes**: nombres claros y homogéneos para clases, métodos, archivos y rutas; uso de sufijos estándar (`.entity.ts`, `.service.ts`, `.controller.ts`, `.gateway.ts`, `.dto.ts`).
- **Evolución y extensibilidad**: estructura preparada para agregar módulos sin modificar los existentes; configuración centralizada y reutilizable.

## 3. Estructura Modular y Carpetas
```
src/
├── app.module.ts
├── main.ts
├── config/
│   ├── configuration.ts
│   ├── validation.ts
│   └── database.config.ts
├── common/
│   ├── decorators/
│   ├── exceptions/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
├── database/
│   ├── migrations/
│   └── seeds/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── gateways/
│   │   └── services/
│   ├── users/
│   ├── products/
│   ├── matches/
│   ├── notifications/
│   └── analytics/
└── websockets/
    ├── events.enum.ts
    └── socket-io.adapter.ts
```

### Consideraciones por carpeta
- `config/`: manejadores de variables de entorno, esquemas de validación (`class-validator`/`Joi`), configuración Swagger, CORS y logger.
- `common/`: componentes compartidos reutilizables y utilitarios. Mantenerlos libres de dependencias circulares.
- `database/`: scripts de inicialización, `DataSource` de TypeORM, y archivos de migración/seed.
- `modules/`: cada módulo de dominio vive dentro de su propia carpeta con subcarpetas dedicadas a `controllers`, `services`, `entities`, `dto`, `gateways`, `repositories` (si se usan personalizados) y `submodules` si hay agregados complejos.
- `websockets/`: adaptadores de socket.io y definición centralizada de eventos para mantener coherencia entre gateways.

## 4. Dependencias Clave
- **NestJS Core**: `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/config`.
- **TypeORM & DB**: `@nestjs/typeorm`, `typeorm`, `pg`.
- **Validación/Transformación**: `class-validator`, `class-transformer`.
- **Autenticación**: `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`.
- **Documentación**: `@nestjs/swagger`, `swagger-ui-express`.
- **Tiempo real**: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`.
- **Herramientas adicionales**: `winston` o `pino` para logging, `cache-manager` opcional para caching, `bull` si se incorporan colas.
- **Testing**: `@nestjs/testing`, `jest`, `supertest`.

## 5. Convenciones de Nombres y Estilo
- **Archivos**: `kebab-case` (`product-match.service.ts`).
- **Clases**: `PascalCase` (`ProductMatchService`).
- **Métodos/propiedades**: `camelCase`.
- **Entidades**: sufijo `.entity.ts`, singular (`ProductEntity`).
- **DTOs**: sufijo `.dto.ts`, prefijo con la acción (`CreateProductDto`, `UpdateProductDto`).
- **Controladores**: sufijo `.controller.ts`, prefijo con el dominio (`ProductsController`).
- **Gateways**: sufijo `.gateway.ts`, prefijo con el dominio (`MatchesGateway`).
- **Rutas REST**: plural (`/products`, `/matches`).
- **Eventos Socket**: constante en `PascalCase` agrupada en `enum` o `const` (`MatchesEvents.PRODUCT_MATCHED`).
- **Módulos**: nombre de carpeta en plural (`products`), clase módulo `ProductsModule`.

## 6. Organización de Componentes

### Entidades (Domain Layer)
- Ubicadas en `modules/<dominio>/entities/`.
- Usan decoradores TypeORM (`@Entity`, `@Column`, etc.).
- Incluyen relaciones (`@ManyToOne`, `@OneToMany`) y `enum`/`value objects` cuando aplica.
- Mantener lógica de dominio simple (métodos de negocio acotados a consistencia de entidad).

### DTOs (Transport Layer)
- Ubicados en `modules/<dominio>/dto/`.
- Separar DTOs por caso de uso (`Create`, `Update`, `Filter`, `Response`).
- Usar `class-validator` y `class-transformer` para validaciones y transformaciones.
- Mantener DTOs planos; no incluir lógica de dominio.

### Servicios (Application Layer)
- Ubicados en `modules/<dominio>/services/`.
- Contienen lógica de negocio, orquestación de repositorios y gateways.
- Dividir responsabilidades si crecen (`*.use-case.ts` o `*.handler.ts` dentro de `services/`).
- Servicios interactúan con repositorios TypeORM (`@InjectRepository`) o repositorios personalizados.

### Repositorios
- Si se requieren repositorios custom, colocarlos en `modules/<dominio>/repositories/`.
- Extender `Repository<Entity>` o usar `DataSource` para queries complejas.

### Controladores (REST)
- Ubicados en `modules/<dominio>/controllers/`.
- Exponen endpoints REST con `@Controller('products')` etc.
- Manejan DTOs para entrada/salida, delegan al servicio.
- Documentados con decoradores de Swagger (`@ApiTags`, `@ApiResponse`).

### Gateways (WebSockets)
- Ubicados en `modules/<dominio>/gateways/`.
- Extienden `WebSocketGateway` con configuración centralizada de namespace/rooms.
- Emplean servicios para lógica y publican eventos definidos en `websockets/events.enum.ts`.

### Guards, Interceptors y Pipes comunes
- Residen en `common/guards`, `common/interceptors`, etc.
- Autenticación JWT, autorización por roles, logging global, transformación de respuestas.

## 7. Flujos Principales

### 7.1 Autenticación y autorización
1. Usuario se registra o inicia sesión vía `AuthController`.
2. `AuthService` gestiona validaciones, hashing con `bcrypt` y emisión de JWT.
3. Guard global (`JwtAuthGuard`) protege rutas; `RolesGuard` controla acceso granular.
4. Gateways utilizan `WsJwtGuard` compartido para validar conexiones WebSocket.

### 7.2 Gestión de productos
1. `ProductsController` expone CRUD con paginación y filtros.
2. `ProductsService` se apoya en `ProductRepository` (TypeORM) para persistencia.
3. Se generan eventos de cambio relevantes (ej. `ProductCreated`) vía `MatchesGateway` si se requiere notificar en tiempo real.

### 7.3 Motor de matcheo
1. `MatchesService` recibe triggers (eventos REST o WebSocket) para ejecutar el algoritmo de matching.
2. El servicio consulta entidades relacionadas (`Products`, `Users`, `Preferences`).
3. Una vez determinado el match, persiste la entidad `Match` y emite evento `MatchesEvents.PRODUCT_MATCHED`.
4. `MatchesGateway` envía eventos a clientes suscritos y registra métricas.

### 7.4 Notificaciones
1. `NotificationsService` escucha eventos de dominio (via `EventEmitter` o `Domain Events`).
2. Publica mensajes por WebSocket (`NotificationsGateway`) y opcionalmente colas (Bull) para correo/SMS.
3. Controlador REST permite consultar historial y marcar leídas.

### 7.5 Analítica
1. `AnalyticsModule` recopila data de uso (matches creados, conversiones, tiempos de respuesta).
2. Servicios agregan métricas y exponen endpoints/gateways para dashboards.
3. Opcional: persistir agregados en tablas dedicadas o enviar a un data warehouse.

## 8. Configuración y Bootstrap
- `main.ts`: configurar `ValidationPipe`, `ClassSerializerInterceptor`, global prefix `/api`, configuración CORS y versionado.
- Swagger configurado en `AppModule` usando `SwaggerModule` y `DocumentBuilder`.
- `SocketIoAdapter` personalizado instanciado en `main.ts` para compartir autenticación.

## 9. Migraciones y Seeds
- `database/migrations`: generadas con CLI TypeORM o `typeorm migration:create`.
- `database/seeds`: scripts para datos iniciales (`ts-node`/`nestjs-command`).
- Incorporar comandos npm (`npm run migration:run`, `npm run seed`).

## 10. Observabilidad y Mantenimiento
- Logging estructurado con `winston`/`pino` integrado mediante `LoggerService` custom.
- Monitoreo de salud con `@nestjs/terminus` (endpoint `/health`).
- Configurar `ConfigModule` en modo global para gestionar entornos (`development`, `staging`, `production`).
- Tests unitarios a nivel de servicios y e2e para módulos críticos (`auth`, `products`, `matches`).

## 11. Roadmap de Implementación
1. **Fase de base**: configuración de proyecto, módulos `users`, `auth`, infraestructura DB, Swagger y WebSockets base.
2. **Fase de dominio**: implementación de `products`, `matches`, notificaciones básicas.
3. **Fase de optimización**: motor de matching avanzado, analítica, mejoras de performance (caching, colas).
4. **Fase de observabilidad**: métricas, tracing, alertas.

Este plan establece la base modular y escalable necesaria para el backend de Codex, asegurando claridad en responsabilidades y facilidad de evolución.
