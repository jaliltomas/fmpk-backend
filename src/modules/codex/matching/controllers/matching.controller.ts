import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ResetMatchesDto } from '../../dto/reset-matches.dto';
import { UpdateMatchStatusDto } from '../../dto/update-match-status.dto';
import { MatchingService } from '../services/matching.service';

@ApiTags('matching')
@Controller({ path: 'sessions/:sessionId/matching', version: '1' })
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Patch('candidates/:candidateId/status')
  updateMatchStatus(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('candidateId', new ParseUUIDPipe({ version: '4' })) candidateId: string,
    @Body() updateMatchStatusDto: UpdateMatchStatusDto,
  ) {
    return this.matchingService.updateMatchStatus(
      sessionId,
      candidateId,
      updateMatchStatusDto,
    );
  }

  @Post('reset')
  resetMatches(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() resetMatchesDto: ResetMatchesDto,
  ) {
    return this.matchingService.resetMatches(sessionId, resetMatchesDto);
  }
}
