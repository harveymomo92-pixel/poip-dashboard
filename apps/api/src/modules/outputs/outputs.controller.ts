import { Controller, Get, Inject, NotFoundException, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { parseQuery } from "../../common/validation.js";
import { outputsQuerySchema } from "../dashboard/dashboard.query.js";
import type { OutputListFilters } from "../dashboard/dashboard.types.js";
import { OutputsService } from "./outputs.service.js";

const idSchema = z.string().uuid();

@Controller("outputs")
@RequirePermissions("output.view")
export class OutputsController {
  constructor(@Inject(OutputsService) private readonly outputsService: OutputsService) {}

  @Get()
  listOutputs(@Query() query: Record<string, unknown>) {
    const filters = parseQuery(outputsQuerySchema, query) as OutputListFilters;
    return this.outputsService.listOutputs(filters);
  }

  @Get(":id")
  async getOutput(@Param("id") id: string) {
    const output = await this.outputsService.getOutput(parseQuery(idSchema, id));
    if (!output) throw new NotFoundException("Output not found");
    return output;
  }
}
