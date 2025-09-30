import { DataSource, DataSourceOptions } from 'typeorm';

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'codex',
  password: process.env.DATABASE_PASSWORD ?? 'codex',
  database: process.env.DATABASE_NAME ?? 'codex',
  entities: ['dist/**/*.entity.js', 'src/**/*.entity.ts'],
  migrations: ['dist/migrations/*.js', 'src/migrations/*.ts'],
  synchronize: false,
};

const dataSource = new DataSource(typeOrmConfig);

export default dataSource;
