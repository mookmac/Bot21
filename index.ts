// Import required packages
import * as path from 'path';
import * as restify from "restify";

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  MemoryStorage,
} from "botbuilder";

// This bot's main dialog.
import { TeamsBot } from "./teamsBot";
import config from "./config";
import { AI, Application, ConversationHistory, DefaultPromptManager, DefaultTurnState, OpenAIModerator, OpenAIPlanner } from "@microsoft/teams-ai";
import { randomInt } from 'crypto';

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: config.botId,
  MicrosoftAppPassword: config.botPassword,
  MicrosoftAppType: "MultiTenant",
});

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
  {},
  credentialsFactory
);

const adapter = new CloudAdapter(botFrameworkAuthentication);

// Catch-all for errors.
const onTurnErrorHandler = async (context: TurnContext, error: Error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity(`The bot encountered unhandled error:\n ${error.message}`);
  await context.sendActivity("To continue to run this bot, please fix the bot source code.");
};

// Set the onTurnError for the singleton CloudAdapter.
adapter.onTurnError = onTurnErrorHandler;

// Create the bot that will handle incoming messages.
const bot = new TeamsBot();

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\nBot Started, ${server.name} listening to ${server.url}`);
});

//Teams AI Library

//create state
interface ConversationState {
  InitiativeRoll: number;
}
type ApplicationTurnState = DefaultTurnState<ConversationState>;

//define AI library components

//define planner
const planner = new OpenAIPlanner({
  apiKey: config.OpenAIKey,
  defaultModel: "text-davinci-003",
  logRequests: true,
});

//define moderator
const moderator = new OpenAIModerator({
  apiKey: config.OpenAIKey,
  moderate: "both"
});

//define prompt manager
const promptManager = new DefaultPromptManager<ApplicationTurnState>(path.join(__dirname, "./prompts"));

//define storage
const storage = new MemoryStorage();

//define AI app
const app = new Application<ApplicationTurnState>({
  storage,
  ai: {
    planner,
    moderator,
    promptManager,
    prompt: "chat",
    history: {
      assistantHistoryType: "text"
    }
  }
});

//define actions

app.ai.action(AI.FlaggedInputActionName, async (context, state,data) => {
  await context.sendActivity("Your message was flagged by the moderator.");
  return false;
});

app.ai.action(AI.FlaggedOutputActionName,async (context, state,data) => {
  await context.sendActivity("Bot's response was flagged by moderator");
  return false;
});

app.ai.action('RollForInitiative', async (context: TurnContext, state: ApplicationTurnState) => {
  state.conversation.value.InitiativeRoll = randomInt(1,20);
  const response = "Initiative: " + state.conversation.value.InitiativeRoll;
  await context.sendActivity(response);
  ConversationHistory.appendToLastLine(state, ` THEN SAY ${response}`);
  return false;
});

  
//define history
app.message("/history", async(context,state) => {
  const history = ConversationHistory.toString(state,2000,'\n\n');
  await context.sendActivity(history);
});

// Listen for incoming requests.
server.post("/api/messages", async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await app.run(context);
  });
});
