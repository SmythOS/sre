import { Storage } from "@google-cloud/storage";
import { Component } from "./Component.class";
import { IAgent as Agent } from "@sre/types/Agent.types";
import Joi from "joi";
import { TemplateStringHelper } from "@sre/helpers/TemplateString.helper";

export class GCPBucket extends Component {
  protected configSchema = Joi.object({
    projectId: Joi.string().max(200).required().label("GCP Project ID"),
    keyFilename: Joi.string().max(500).allow("").label("Path to service account key JSON"),
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
    logger.debug("=== GCP Bucket Connector ===");

    try {
      // Resolve project + keyfile from config (supports Smyth team key substitution)
      const teamId = agent?.teamId;
      const projectId = (await TemplateStringHelper.create(config?.data?.projectId).parseTeamKeysAsync(teamId).asyncResult) as string;
      const keyFilename = config?.data?.keyFilename || undefined;

      if (!projectId) {
        return { _error: "Please provide a valid GCP Project ID", _debug: logger.output };
      }

      const storage = new Storage({ projectId, keyFilename });

      const [buckets] = await storage.getBuckets();
      const bucketNames = buckets.map(b => b.name);

      logger.debug("Buckets: ", bucketNames);

      return { Output: bucketNames, _debug: logger.output };
    } catch (error: any) {
      logger.debug("Error: ", error?.message);
      return { _error: error?.message || JSON.stringify(error), _debug: logger.output };
    }
  }
}
