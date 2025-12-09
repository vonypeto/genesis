import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { LLMAgentService } from '../../features/llm-agent-model/llm-agent.service';

@Controller()
export class AgentController {
  constructor(private readonly service: LLMAgentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async start(
    @Body()
    body: {
      prompts: string[];
      brands: string[];
      models: string[];
      notes?: string;
    }
  ) {
    return this.service.startRun(body);
  }

  @Get(':id/summary')
  async summary(@Param('id') id: string) {
    return this.service.getRunSummary(id);
  }

  @Get(':id/status')
  async status(@Param('id') id: string) {
    // Fetch run from repository and return status
    return this.service.getRunStatus(id);
  }
}
