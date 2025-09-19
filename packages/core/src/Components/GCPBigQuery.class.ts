import { BigQuery } from "@google-cloud/bigquery";
import { Component } from "./Component.class";
import { IAgent as Agent } from "@sre/types/Agent.types";
import Joi from "joi";
import { TemplateStringHelper } from "@sre/helpers/TemplateString.helper";

export class GCPBigQuery extends Component {
  protected configSchema = Joi.object({
    projectId: Joi.string().max(200).required().label("GCP Project ID"),
    keyFilename: Joi.string().max(500).allow("").label("Path to service account key JSON"),
    datasetId: Joi.string().max(200).required(),
    tableId: Joi.string().max(200).required(),
    schema: Joi.string().required().label("Table schema as JSON"),
    name: Joi.string().max(100).required(),
    displayName: Joi.string().max(100).required(),
    desc: Joi.string().max(5000).allow(""),
    logoUrl: Joi.string().max(500).allow(""),
  });

  constructor() {
    super();
  }

  init() {}

  async process(input, config, agent: Agent) {
    await super.process(input, config, agent);

    const logger = this.createComponentLogger(agent, config);
    logger.debug("=== GCP BigQuery Connector ===");

    try {
      const teamId = agent?.teamId;
      const projectId = (await TemplateStringHelper.create(config?.data?.projectId).parseTeamKeysAsync(teamId).asyncResult) as string;
      const keyFilename = config?.data?.keyFilename || undefined;
      const datasetId = config?.data?.datasetId;
      const tableId = config?.data?.tableId;
      const schemaJson = JSON.parse(config?.data?.schema);

      if (!projectId || !datasetId || !tableId || !schemaJson) {
        return { _error: "Please provide projectId, datasetId, tableId, and schema", _debug: logger.output };
      }

      const bigquery = new BigQuery({ projectId, keyFilename });

      const [table] = await bigquery.dataset(datasetId).createTable(tableId, { schema: schemaJson });

      logger.debug(`Created table: ${datasetId}.${tableId}`);

      return { Output: `Table ${table.id} created successfully`, _debug: logger.output };
    } catch (error: any) {
      logger.debug("Error: ", error?.message);
      return { _error: error?.message || JSON.stringify(error), _debug: logger.output };
    }
  }
}
