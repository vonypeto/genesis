import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { LLMAgentService } from '../../features/llm-agent-model/llm-agent.service';
import { Run } from '../../features/llm-agent-model/repositories/run.repository';
import { RedisService } from '@genesis/redis';
import { RateLimiterService } from '@genesis/rate-limiter';
import { CreateRunRequest, CreateRunResponse } from '../../libs/dtos';

@Controller()
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    private readonly llmAgentService: LLMAgentService,
    private readonly redisService: RedisService,
    private readonly rateLimiterService: RateLimiterService
  ) {}

  @Post('runs')
  async createRun(@Body() input: CreateRunRequest): Promise<CreateRunResponse> {
    this.logger.log(
      `Creating run with ${input.prompts?.length || 0} prompts, ${
        input.brands?.length || 0
      } brands, ${input.models?.length || 0} models`
    );

    try {
      const result = await this.llmAgentService.createRun(input);

      if (result.isNew) {
        this.logger.log(
          `Run created successfully: ${result.run?.id}, Status: ${result.run?.status}`
        );
        return {
          run: result.run,
          message:
            'Run created successfully. Processing has started in the background.',
          isNew: result.isNew,
        };
      } else {
        this.logger.log(
          `Returning existing run (idempotent): ${result.run?.id}`
        );
        return {
          run: result.run,
          message:
            'Returning existing run (idempotent). This run was already created.',
          isNew: result.isNew,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to create run: ${(error as Error).message}`,
        (error as Error).stack
      );
      throw new HttpException(
        (error as Error).message || 'Failed to create run',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('runs')
  async listRuns(
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<{
    data: Run[];
    total: number;
    page: number;
    limit: number;
  }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    this.logger.debug(`Listing runs: page=${pageNum}, limit=${limitNum}`);

    const result = await this.llmAgentService.listRuns(pageNum, limitNum);

    this.logger.debug(
      `Retrieved ${result.data.length} runs out of ${result.total} total`
    );

    return {
      ...result,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get('runs/:id')
  async getRun(@Param('id') id: string): Promise<Run> {
    this.logger.debug(`Fetching run: ${id}`);

    // TODO: Implement getRunById in LLMAgentService
    throw new HttpException('Not implemented', HttpStatus.NOT_IMPLEMENTED);
  }

  @Get('runs/:id/summary')
  async getRunSummary(@Param('id') id: string): Promise<any> {
    this.logger.debug(`Fetching summary for run: ${id}`);

    // TODO: Implement getRunSummary in LLMAgentService
    throw new HttpException('Not implemented', HttpStatus.NOT_IMPLEMENTED);
  }

  @Get('runs/:id/chat')
  async getRunChat(@Param('id') id: string): Promise<any> {
    this.logger.debug(`Fetching chat view for run: ${id}`);

    // TODO: Implement getRunChat in LLMAgentService
    throw new HttpException('Not implemented', HttpStatus.NOT_IMPLEMENTED);
  }

  @Get('gethealth')
  async getHealth() {
    this.logger.debug('Health check requested');

    const redisInfo = await this.redisService.getInfo();
    const rateLimiterStats = this.rateLimiterService.getAllStats();
    const distributedStats = this.rateLimiterService.getDistributedStats();

    const health = {
      status: 'ok',
      redis: redisInfo,
      rateLimiting: {
        distributedEnabled: this.redisService.isRedisConnected(),
        localLimiters: rateLimiterStats,
        distributedLimiters: distributedStats,
      },
      timestamp: new Date().toISOString(),
    };

    this.logger.debug(
      `Health check: Redis connected=${this.redisService.isRedisConnected()}, Rate limiting active=${
        Object.keys(rateLimiterStats).length
      } limiters`
    );

    return health;
  }
}
