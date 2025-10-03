import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { Product } from './entities/product.entity';
import { MatchingService } from './matching.service';

@Injectable()
export class ProductsService {
  private readonly products = new Map<string, Product>();

  constructor(private readonly matchingService: MatchingService) {}

  create(createProductDto: CreateProductDto): Product {
    const product = Object.assign(new Product(), {
      ...createProductDto,
      scrapedate: new Date(createProductDto.scrapedate),
    });

    this.products.set(product.ean, product);
    return product;
  }

  findAll(): Product[] {
    return Array.from(this.products.values());
  }

  findOne(ean: string): Product {
    const product = this.products.get(ean);
    if (!product) {
      throw new NotFoundException(`Product with EAN ${ean} not found`);
    }
    return product;
  }

  async matchProduct(product: CreateProductDto, nodeIds: string[]) {
    const results = await this.matchingService.matchProduct(product, nodeIds);
    return {
      product,
      results,
    };
  }
}
