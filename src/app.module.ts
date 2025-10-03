import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

import { SessionsModule } from './modules/codex/sessions/sessions.module';
import { ProductsModule } from './modules/products/products.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', `.env.${process.env.NODE_ENV ?? 'development'}`],
            expandVariables: true,
        }),
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
                type: 'postgres',
                host: configService.get<string>('DATABASE_HOST', 'localhost'),
                port: Number(configService.get<string>('DATABASE_PORT', '5432')),
                username: configService.get<string>('DATABASE_USER', 'codex'),
                password: configService.get<string>('DATABASE_PASSWORD', 'codex'),
                database: configService.get<string>('DATABASE_NAME', 'codex'),
                autoLoadEntities: true,
                synchronize: false,
                migrationsRun: false,
            }),
        }),
        SessionsModule,
        ProductsModule,
    ],
})
export class AppModule {}
