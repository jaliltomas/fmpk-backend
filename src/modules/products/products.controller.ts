import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { MatchProductDto } from './dto/match-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':ean')
  findOne(@Param('ean') ean: string) {
    return this.productsService.findOne(ean);
  }

  @Post('match')
  matchProduct(@Body() matchProductDto: MatchProductDto) {
    return this.productsService.matchProduct(
      matchProductDto.product,
      matchProductDto.nodeIds,
    );
  }
}
