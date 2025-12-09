import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { StartRunDto } from '../dto/start-run.dto';
import crypto from 'crypto';
import { LLMAgentService } from '../../features/llm-agent-model/llm-agent.service';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { Tokens } from '../../libs/tokens';
import { Joser } from '@scaleforge/joser';
import { Idempotency } from '../interceptor/idempotency';
import { ObjectId } from '@genesis/object-id';
import { AsyncEventDispatcherService } from '@genesis/async-event-module';

@Controller()
export class AgentController {
  constructor(
    private readonly service: LLMAgentService,
    @Inject(Tokens.Redis)
    private readonly redis: Redis,
    @Inject(Tokens.Redlock)
    private readonly redlock: Redlock,
    private readonly joser: Joser,
    private readonly dispatcher: AsyncEventDispatcherService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @Idempotency((body: StartRunDto) => {
  //   const hash = crypto
  //     .createHash('sha256')
  //     .update(JSON.stringify(body))
  //     .digest('hex');
  //   return hash;
  // })
  async start(
    @Body()
    body: StartRunDto
  ) {
    const id = ObjectId.generate();

    console.log(id, id.toString(), id.toString('base64'), id.toString('bs58'));

    await this.service.startRun({ ...body, id });
    // await this.dispatcher.dispatch(
    //   ['agent'],
    //   {
    //     id: ObjectId.generate(),
    //     type: 'StartRunCreated',
    //     payload: { ...body, id: id.toString() },
    //     timestamp: new Date(),
    //   },
    //   {
    //     category: 'HIGH',
    //     delay: 5000,
    //   }
    // );

    return { runId: id.toString() };
  }

  @Get(':id/summary')
  async summary(@Param('id') id: string) {
    return this.service.getRunSummary(id);
  }

  @Get(':id/status')
  async status(@Param('id') id: string) {
    return this.service.getRunStatus(id);
  }
}
