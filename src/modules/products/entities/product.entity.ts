import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'products' })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  nombre!: string;

  @Column({ type: 'varchar', length: 255 })
  marca!: string;

  @Column({ type: 'varchar', length: 1024 })
  img!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioFinal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioLista!: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  precioKiloLitro!: number;

  @Column({ type: 'varchar', length: 255 })
  categoria!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subcategoria!: string;

  @Column({ type: 'varchar', length: 32 })
  ean!: string;

  @Column({ type: 'timestamptz' })
  scrapedate!: Date;

  @Column({ type: 'varchar', length: 1024 })
  url_producto!: string;

  @Column({ type: 'varchar', length: 255 })
  sitio!: string;
}
