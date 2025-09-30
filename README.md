# Codex Backend

Codex es la plataforma de matcheo de productos para retailers y marketplaces. Este repositorio contiene la configuración base del backend construido con [NestJS](https://nestjs.com/), [TypeORM](https://typeorm.io/) y PostgreSQL.

## Requisitos previos

- Node.js 18+
- npm 9+
- Docker y Docker Compose (para ejecutar la base de datos localmente)

## Configuración del entorno

1. Copia el archivo de variables de entorno y ajusta los valores según tu entorno:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` para definir las credenciales de la base de datos y el puerto del servidor.

## Instalación

Instala las dependencias del proyecto:

```bash
npm install
```

## Base de datos con Docker

Para levantar una instancia local de PostgreSQL utiliza Docker Compose:

```bash
docker compose up -d
```

Las credenciales y el nombre de la base de datos se pueden configurar mediante las variables de entorno `DATABASE_USER`, `DATABASE_PASSWORD` y `DATABASE_NAME`.

## Ejecución de la aplicación

Inicia el servidor en modo desarrollo con recarga automática:

```bash
npm run start:dev
```

Compila la aplicación y ejecútala en modo producción:

```bash
npm run build
npm run start
```

La API se expone bajo el prefijo `/api` y la documentación Swagger estará disponible en `http://localhost:3000/api/docs`.

## Migraciones de base de datos

Genera una nueva migración:

```bash
npm run migration:generate -- src/migrations/NombreDeLaMigracion
```

Ejecuta las migraciones pendientes:

```bash
npm run migration:run
```

## Estructura del proyecto

- `src/main.ts`: punto de entrada con configuración de Swagger, Validación y prefijo global `/api`.
- `src/app.module.ts`: módulo raíz con `ConfigModule` y `TypeOrmModule`.
- `src/config/typeorm.config.ts`: configuración de TypeORM reutilizable para CLI y la aplicación.
- `docker-compose.yml`: orquestación de Postgres para desarrollo local.
- `docs/`: documentación de arquitectura y decisiones.

No se ha incluido lógica de negocio ni pruebas automáticas en esta etapa inicial.
